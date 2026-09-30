import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import type { AwsUsage } from '../../../shared/types.js';
import type { Configuration } from './config.js';

/**
 * The same quantities the receipt shows, read from AWS instead of from our own counters.
 *
 * Why this exists: `Meter` counts what the handler observed (ReturnConsumedCapacity), which is the real
 * metered quantity but is buffered per Lambda container and can lose the last few requests of a container
 * that is never invoked again. CloudWatch publishes what AWS itself recorded, so it is the check on our maths.
 *
 * Two honest limits, repeated on the slide: the numbers are per *resource*, not per session (one session at
 * a time during a talk), and CloudWatch publishes with a delay of one to three minutes.
 */
const INDEXES = ['ByTime', 'ByScore'] as const;
/**
 * Verified against the dev stack (2026-09-30): the TableName-only dimension does NOT include index
 * consumption. A controlled burst costing 3 table + 1 ByTime units per write reported 65 and 23 in the
 * same minute, not 88 — so the two dimensions are disjoint and the total is their sum, as usageCost does.
 */
const MAX_WINDOW_MS = 6 * 3600 * 1000;

interface Query { Id: string; MetricStat: { Metric: { Namespace: string; MetricName: string; Dimensions: { Name: string; Value: string }[] }; Period: number; Stat: string } }

export class Usage {
  private client?: CloudWatchClient;
  constructor(private config: Configuration) {}

  /** Lazily created: a session that never opens the cost scene pays nothing and needs no CloudWatch call. */
  private get cw() {
    return (this.client ??= new CloudWatchClient({ region: this.config.region, maxAttempts: 2 }));
  }

  /** `apiId` comes from the request event; the configured one is only a fallback for local runs. */
  async read(from: number, to: number, apiId?: string, period = 60): Promise<AwsUsage> {
    const start = Math.max(from, to - MAX_WINDOW_MS);
    const table = this.config.tableName, fn = this.config.functionName, api = apiId || this.config.apiId;
    const metric = (Id: string, Namespace: string, MetricName: string, dims: Record<string, string>, Stat = 'Sum'): Query => ({
      Id, MetricStat: { Metric: { Namespace, MetricName, Dimensions: Object.entries(dims).map(([Name, Value]) => ({ Name, Value })) }, Period: period, Stat },
    });
    const queries: Query[] = [
      metric('wt', 'AWS/DynamoDB', 'ConsumedWriteCapacityUnits', { TableName: table }),
      metric('rt', 'AWS/DynamoDB', 'ConsumedReadCapacityUnits', { TableName: table }),
      metric('thr', 'AWS/DynamoDB', 'ThrottledRequests', { TableName: table }),
      ...INDEXES.flatMap((name, i) => [
        metric(`wi${i}`, 'AWS/DynamoDB', 'ConsumedWriteCapacityUnits', { TableName: table, GlobalSecondaryIndexName: name }),
        metric(`ri${i}`, 'AWS/DynamoDB', 'ConsumedReadCapacityUnits', { TableName: table, GlobalSecondaryIndexName: name }),
      ]),
      ...(fn ? [
        metric('inv', 'AWS/Lambda', 'Invocations', { FunctionName: fn }),
        metric('dur', 'AWS/Lambda', 'Duration', { FunctionName: fn }),
        metric('err', 'AWS/Lambda', 'Errors', { FunctionName: fn }),
      ] : []),
      ...(api ? [metric('api', 'AWS/ApiGateway', 'Count', { ApiId: api })] : []),
    ];
    const output = await this.cw.send(new GetMetricDataCommand({
      StartTime: new Date(start), EndTime: new Date(to), ScanBy: 'TimestampAscending', MetricDataQueries: queries,
    }), { abortSignal: AbortSignal.timeout(3000) });

    const sums = new Map<string, number>();
    let latest = 0;
    for (const result of output.MetricDataResults ?? []) {
      const values = result.Values ?? [];
      sums.set(result.Id!, values.reduce((total, value) => total + value, 0));
      for (const [i, at] of (result.Timestamps ?? []).entries()) if ((values[i] ?? 0) > 0) latest = Math.max(latest, at.getTime());
    }
    const sum = (id: string) => sums.get(id) ?? 0;
    const byIndex = (prefix: string) => Object.fromEntries(INDEXES.map((name, i) => [name, sum(`${prefix}${i}`)]).filter(([, v]) => (v as number) > 0));
    return {
      from: start, to, period, staleMs: latest ? Math.max(0, to - (latest + period * 1000)) : null,
      wruTable: sum('wt'), rruTable: sum('rt'), wruGsi: byIndex('wi'), rruGsi: byIndex('ri'),
      apiRequests: sum('api'), lambdaInvocations: sum('inv'), lambdaMs: sum('dur'), lambdaErrors: sum('err'), throttled: sum('thr'),
    };
  }
}
