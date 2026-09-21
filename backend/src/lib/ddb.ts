import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { Inspect, InspectOperation } from '../../../shared/types.js';
import type { Configuration } from './config.js';
export const newClient = (config: Pick<Configuration,'region'|'endpoint'>) => DynamoDBDocumentClient.from(new DynamoDBClient({
  region: config.region, endpoint: config.endpoint,
  ...(config.endpoint ? {credentials: {accessKeyId:'local',secretAccessKey:'local'}} : {}),
  maxAttempts: 3,
}), {marshallOptions:{removeUndefinedValues:true}});
export interface Counters { apiCalls: number; wruTable: number; wruGsi: number; rruTable: number; rruGsi: number; lambdaMs: number }
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
/** Only economic estimates are buffered. Game counters are persisted transactionally. */
export class Meter {
  private pending = new Map<string,{values:Counters;flushed:number;busy:boolean}>();
  async record(sid: string, db: RequestDb, elapsed: number, now: number) {
    let state = this.pending.get(sid);
    if (!state) { state={values:zero(),flushed:now,busy:false}; this.pending.set(sid,state); }
    const delta = {...db.counters,apiCalls:1,lambdaMs:elapsed};
    for (const k of Object.keys(delta) as (keyof Counters)[]) state.values[k]+=delta[k];
    if (state.busy || now-state.flushed<2000) return;
    state.busy=true; const snapshot=state.values; state.values=zero();
    try {
      const fields=Object.keys(snapshot) as (keyof Counters)[];
      const output = await db.client.send(new UpdateCommand({TableName:db.table,Key:{PK:`SESSION#${sid}`,SK:'STATS'},
        UpdateExpression:`ADD ${fields.map(k=>`#${k} :${k}`).join(', ')}`,
        ConditionExpression:'attribute_exists(PK)',
        ExpressionAttributeNames:Object.fromEntries(fields.map(k=>[`#${k}`,k])),
        ExpressionAttributeValues:Object.fromEntries(fields.map(k=>[`:${k}`,snapshot[k]])),ReturnConsumedCapacity:'INDEXES'}));
      state.values.wruTable += output.ConsumedCapacity?.Table?.CapacityUnits ?? output.ConsumedCapacity?.CapacityUnits ?? 0;
      state.flushed=now;
    } catch { for (const k of Object.keys(snapshot) as (keyof Counters)[]) state.values[k]+=snapshot[k]; }
    finally { state.busy=false; }
    // Bound inactive telemetry in a reused container; discarding it only affects estimates.
    if (this.pending.size>100) for (const [key,value] of this.pending) if (!value.busy && now-value.flushed>60000) this.pending.delete(key);
  }
}
