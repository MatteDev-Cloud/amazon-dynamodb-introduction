/**
 * Just enough DynamoDB to exercise the flows this app actually writes: single-table Get/Put/Update/Query,
 * TransactWrite with condition checks, the two GSIs, and ReturnConsumedCapacity so the meter has something
 * to count. It is not a DynamoDB emulator — it only understands the expression forms used in app.ts, and it
 * throws on anything else rather than quietly passing.
 */
export class Cancelled extends Error {
  name = 'TransactionCanceledException';
  constructor(public CancellationReasons: { Code: string }[]) { super('Transaction cancelled'); }
}
class ConditionFailed extends Error { name = 'ConditionalCheckFailedException'; }

type Item = Record<string, any>;
const itemKey = (item: Item) => `${item.PK}\u0000${item.SK}`;

/** Resolves `:value`, `#name` or a bare attribute path against the item and the expression maps. */
function operand(token: string, item: Item | undefined, names: Record<string, string>, values: Record<string, any>) {
  token = token.trim();
  if (token.startsWith(':')) return values[token];
  const path = token.startsWith('#') ? names[token] : token;
  return item?.[path!];
}

/** Supports the subset app.ts uses: attribute_exists/_not_exists, =, >, <=, AND/OR, one level of parentheses. */
function condition(expression: string | undefined, item: Item | undefined, names: Record<string, string> = {}, values: Record<string, any> = {}): boolean {
  if (!expression) return true;
  const text = unwrap(expression.trim());
  for (const [operator, combine] of [[' OR ', (a: boolean, b: boolean) => a || b], [' AND ', (a: boolean, b: boolean) => a && b]] as const) {
    const parts = split(text, operator);
    if (parts.length > 1) return parts.map(part => condition(part, item, names, values)).reduce(combine);
  }
  const exists = /^attribute_(not_)?exists\((.+)\)$/.exec(text);
  if (exists) {
    const present = operand(exists[2]!, item, names, values) !== undefined;
    return exists[1] ? !present : present;
  }
  const compare = /^(\S+)\s*(<=|>=|<>|=|>|<)\s*(\S+)$/.exec(text);
  if (!compare) throw new Error(`fake-ddb: unsupported condition "${text}"`);
  const left = operand(compare[1]!, item, names, values), right = operand(compare[3]!, item, names, values);
  switch (compare[2]) {
    case '=': return left === right;
    case '<>': return left !== right;
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    default: return left <= right;
  }
}
/** Removes one layer of parentheses when they wrap the whole expression. */
function unwrap(text: string): string {
  if (!text.startsWith('(')) return text;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i === text.length - 1 ? unwrap(text.slice(1, -1).trim()) : text;
  }
  return text;
}

/** Splits on a top-level operator only, ignoring anything inside parentheses. */
function split(text: string, operator: string) {
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (depth === 0 && text.startsWith(operator, i)) { parts.push(text.slice(start, i)); start = i + operator.length; i = start - 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

function applyUpdate(item: Item, expression: string, names: Record<string, string>, values: Record<string, any>) {
  // Update expressions are keyword-delimited sections: SET … ADD … REMOVE …
  const sections: Record<string, string> = {};
  for (const part of expression.trim().split(/\s+(?=(?:SET|ADD|REMOVE|DELETE)\s)/i)) {
    const match = /^(SET|ADD|REMOVE|DELETE)\s+(.*)$/is.exec(part.trim());
    if (!match) throw new Error(`fake-ddb: unsupported update "${part}"`);
    sections[match[1]!.toLowerCase()] = match[2]!.trim();
  }
  for (const assignment of sections.set ? split(sections.set, ', ') : []) {
    const [path, value] = assignment.split('=').map(part => part.trim());
    const name = path!.startsWith('#') ? names[path!]! : path!;
    item[name] = values[value!];
  }
  for (const addition of sections.add ? split(sections.add, ', ') : []) {
    const [path, value] = addition.trim().split(/\s+/);
    const name = path!.startsWith('#') ? names[path!]! : path!;
    item[name] = (item[name] ?? 0) + values[value!];
  }
  for (const path of sections.remove ? split(sections.remove, ', ') : []) delete item[path!.trim()];
}

export class FakeDdb {
  items = new Map<string, Item>();
  /** Every command the app sent, in order: used to assert how many writes a gesture really costs. */
  commands: { op: string; input: any }[] = [];
  constructor(seed: Item[] = []) { for (const item of seed) this.items.set(itemKey(item), { ...item }); }

  private capacity(units = 1) { return { ConsumedCapacity: { TableName: 'test', CapacityUnits: units, Table: { CapacityUnits: units } } }; }

  send = async (command: any): Promise<any> => {
    const op = command.constructor.name.replace('Command', ''), input = command.input;
    this.commands.push({ op, input });
    // Reads hand out copies, like the real SDK: a handler that keeps a read item must not observe later writes.
    if (op === 'Get') { const item = this.items.get(`${input.Key.PK}\u0000${input.Key.SK}`); return { Item: item && { ...item }, ...this.capacity(0.5) }; }
    if (op === 'Put') {
      const existing = this.items.get(itemKey(input.Item));
      if (!condition(input.ConditionExpression, existing, input.ExpressionAttributeNames, input.ExpressionAttributeValues)) throw new ConditionFailed();
      this.items.set(itemKey(input.Item), { ...input.Item });
      return this.capacity();
    }
    if (op === 'Update') {
      const key = `${input.Key.PK}\u0000${input.Key.SK}`, existing = this.items.get(key);
      if (!condition(input.ConditionExpression, existing, input.ExpressionAttributeNames, input.ExpressionAttributeValues)) throw new ConditionFailed();
      const item = existing ?? { ...input.Key };
      applyUpdate(item, input.UpdateExpression, input.ExpressionAttributeNames ?? {}, input.ExpressionAttributeValues ?? {});
      this.items.set(key, item);
      return { Attributes: item, ...this.capacity() };
    }
    if (op === 'TransactWrite') {
      const actions: { index: number; run: () => void }[] = [];
      const reasons: { Code: string }[] = input.TransactItems.map(() => ({ Code: 'None' }));
      let failed = false;
      input.TransactItems.forEach((entry: any, index: number) => {
        const [kind, body] = Object.entries(entry)[0] as [string, any];
        const key = body.Key ? `${body.Key.PK}\u0000${body.Key.SK}` : itemKey(body.Item);
        const existing = this.items.get(key);
        if (!condition(body.ConditionExpression, existing, body.ExpressionAttributeNames, body.ExpressionAttributeValues)) { reasons[index] = { Code: 'ConditionalCheckFailed' }; failed = true; return; }
        if (kind === 'Put') actions.push({ index, run: () => this.items.set(key, { ...body.Item }) });
        if (kind === 'Update') actions.push({ index, run: () => {
          const item = existing ?? { ...body.Key };
          applyUpdate(item, body.UpdateExpression, body.ExpressionAttributeNames ?? {}, body.ExpressionAttributeValues ?? {});
          this.items.set(key, item);
        } });
      });
      if (failed) throw new Cancelled(reasons);
      for (const action of actions) action.run();
      return this.capacity(input.TransactItems.length);
    }
    if (op === 'Query') {
      const values = input.ExpressionAttributeValues ?? {}, all = [...this.items.values()];
      let matches: Item[];
      if (input.IndexName === 'ByTime') matches = all.filter(i => i.cv === values[':cv'] && i.updatedAt >= values[':since']).sort((a, b) => a.updatedAt - b.updatedAt);
      else if (input.IndexName === 'ByScore') matches = all.filter(i => i.lb === values[':s']).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      else {
        matches = all.filter(i => i.PK === values[':pk'] && (values[':sk'] === undefined || String(i.SK).startsWith(values[':sk'])));
        matches.sort((a, b) => String(a.SK).localeCompare(String(b.SK)));
      }
      return { Items: matches.map(i => ({ ...i })), Count: matches.length, ...this.capacity(matches.length * 0.5) };
    }
    throw new Error(`fake-ddb: unsupported operation ${op}`);
  };
}
