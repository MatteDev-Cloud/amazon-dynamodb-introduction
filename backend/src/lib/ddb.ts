import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Counters, Inspect, InspectOperation } from '../../../shared/types.js';
import { COUNTERS, audienceField } from '../../../shared/pricing.js';
import type { Configuration } from './config.js';
export const newClient = (config: Pick<Configuration,'region'|'endpoint'>) => DynamoDBDocumentClient.from(new DynamoDBClient({
  region: config.region, endpoint: config.endpoint,
  ...(config.endpoint ? {credentials: {accessKeyId:'local',secretAccessKey:'local'}} : {}),
  maxAttempts: 3,
}), {marshallOptions:{removeUndefinedValues:true}});
const zero = (): Counters => ({apiCalls:0,wruTable:0,wruGsi:0,rruTable:0,rruGsi:0,lambdaMs:0});
export class RequestDb {
  operations: InspectOperation[] = [];
  counters = zero();
  constructor(public client: DynamoDBDocumentClient, public table: string) {}
  // SDK command union overloads cannot retain the response type across this instrumentation boundary.
  async run(command: any): Promise<any> {
    command.input.ReturnConsumedCapacity = 'INDEXES';
    const started = performance.now();
    const result = await this.client.send(command) as any;
    const op = command.constructor.name.replace('Command','');
    const write = /^(Put|Update|Delete|TransactWrite|BatchWrite)/.test(op);
    const capacities = !result.ConsumedCapacity ? [] : Array.isArray(result.ConsumedCapacity) ? result.ConsumedCapacity : [result.ConsumedCapacity];
    const consumed = {table:0,gsi:{} as Record<string,number>,read:{table:0,gsi:{} as Record<string,number>},write:{table:0,gsi:{} as Record<string,number>}};
    const units=(v:any)=>{
      if(v?.ReadCapacityUnits!==undefined||v?.WriteCapacityUnits!==undefined) return {r:v.ReadCapacityUnits??0,w:v.WriteCapacityUnits??0};
      return {r:write?0:v?.CapacityUnits??0,w:write?v?.CapacityUnits??0:0};
    };
    for (const c of capacities) {
      const indexes = {...c.GlobalSecondaryIndexes, ...c.LocalSecondaryIndexes};
      let indexReads=0,indexWrites=0;
      for (const [name,v] of Object.entries(indexes)) {
        const {r,w}=units(v);
        consumed.gsi[name]=(consumed.gsi[name]??0)+r+w;
        consumed.read.gsi[name]=(consumed.read.gsi[name]??0)+r;
        consumed.write.gsi[name]=(consumed.write.gsi[name]??0)+w;
        indexReads+=r;indexWrites+=w;
      }
      const total=units(c), t=c.Table?units(c.Table):{r:Math.max(0,total.r-indexReads),w:Math.max(0,total.w-indexWrites)};
      consumed.table+=t.r+t.w;consumed.read.table+=t.r;consumed.write.table+=t.w;
    }
    this.counters.rruTable+=consumed.read.table;this.counters.wruTable+=consumed.write.table;
    this.counters.rruGsi+=Object.values(consumed.read.gsi).reduce((a,b)=>a+b,0);
    this.counters.wruGsi+=Object.values(consumed.write.gsi).reduce((a,b)=>a+b,0);
    const params: Record<string,unknown> = {};
    for (const key of ['TableName','IndexName','KeyConditionExpression','UpdateExpression','ConditionExpression','ProjectionExpression','ScanIndexForward','Limit','ConsistentRead']) {
      if (command.input[key] !== undefined) params[key] = command.input[key];
    }
    if (command.input.TransactItems) params.actions = command.input.TransactItems.map((item:any)=>Object.keys(item)[0]);
    this.operations.push({op,params,consumed,ddbMs:performance.now()-started,items:result.Count ?? (result.Item || result.Attributes ? 1 : 0)});
    return result;
  }
  async query(input: Record<string,unknown>): Promise<any[]> {
    const items: any[] = []; let cursor;
    do {
      const page = await this.run(new QueryCommand({TableName:this.table,...input,ExclusiveStartKey:cursor} as any));
      items.push(...(page.Items ?? [])); cursor = page.LastEvaluatedKey;
    } while (cursor);
    return items;
  }
  inspect(): Inspect {
    const last = this.operations.at(-1) ?? {op:'None',params:{},consumed:{table:0,gsi:{}},ddbMs:0,items:0};
    return {...last,ddbMs:this.operations.reduce((n,o)=>n+o.ddbMs,0),operations:this.operations};
  }
}
/**
 * Only economic estimates are buffered. Game counters are persisted transactionally.
 *
 * The buffer exists so that measuring does not dominate what it measures: one extra write per request would
 * cost more than most requests do. The price is that a Lambda container which is never invoked again keeps
 * whatever it had not flushed, so the app's own total is a slight *under*count. BATCH bounds that loss, and
 * GET /admin/aws reads the same quantities back from CloudWatch as a check.
 *
 * Every counter is kept twice: the total, and the part that came from the audience (no admin key). The
 * total is what CloudWatch can confirm; the audience part is what a projection may multiply, because one
 * LIM and one regia polling all talk long do not become a thousand when the room does. The meter's own
 * write lands in the total only, so it stays on the presenter's side of the receipt.
 */
const BATCH = 20;
export class Meter {
  private pending = new Map<string,{values:Counters;audience:Counters;flushed:number;busy:boolean}>();
  async record(sid: string, db: RequestDb, elapsed: number, now: number, audience = false) {
    let state = this.pending.get(sid);
    // A cold container flushes on its very first chance instead of waiting: it may not get a second request.
    if (!state) { state={values:zero(),audience:zero(),flushed:0,busy:false}; this.pending.set(sid,state); }
    const delta = {...db.counters,apiCalls:1,lambdaMs:elapsed};
    for (const k of COUNTERS) { state.values[k]+=delta[k]; if (audience) state.audience[k]+=delta[k]; }
    if (state.busy || (now-state.flushed<2000 && state.values.apiCalls<BATCH)) return;
    state.busy=true; const snapshot=state.values, fromAudience=state.audience; state.values=zero(); state.audience=zero();
    try {
      const adds:[string,number][]=COUNTERS.flatMap(k=>[[k,snapshot[k]],[audienceField(k),fromAudience[k]]] as [string,number][]);
      const output = await db.client.send(new UpdateCommand({TableName:db.table,Key:{PK:`SESSION#${sid}`,SK:'STATS'},
        UpdateExpression:`ADD ${adds.map(([name])=>`#${name} :${name}`).join(', ')}`,
        ConditionExpression:'attribute_exists(PK)',
        ExpressionAttributeNames:Object.fromEntries(adds.map(([name])=>[`#${name}`,name])),
        ExpressionAttributeValues:Object.fromEntries(adds.map(([name,value])=>[`:${name}`,value])),ReturnConsumedCapacity:'INDEXES'}));
      state.values.wruTable += output.ConsumedCapacity?.Table?.CapacityUnits ?? output.ConsumedCapacity?.CapacityUnits ?? 0;
      state.flushed=now;
    } catch { for (const k of COUNTERS) { state.values[k]+=snapshot[k]; state.audience[k]+=fromAudience[k]; } }
    finally { state.busy=false; }
    // Bound inactive telemetry in a reused container; discarding it only affects estimates.
    if (this.pending.size>100) for (const [key,value] of this.pending) if (!value.busy && now-value.flushed>60000) this.pending.delete(key);
  }
}
