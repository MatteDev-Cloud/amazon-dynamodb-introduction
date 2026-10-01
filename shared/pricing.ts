import type { AwsUsage, CostShare, Counters, PriceConfig, StatsResponse } from './types.js';
/** Do not substitute unverified US prices for Frankfurt prices. */
export const PRICES: PriceConfig = {
  region: 'eu-central-1', currency: 'USD', verifiedAt: '2026-09-21',
  source: 'https://aws.amazon.com/dynamodb/pricing/on-demand/',
  wruMillion: 0.7625, rruMillion: 0.1525, httpApiMillion: 1.2,
  lambdaRequestsMillion: 0.2, lambdaGbSecond: 0.0000133334, lambdaMemoryGb: 0.25,
};
export const COUNTERS = ['apiCalls', 'wruTable', 'wruGsi', 'rruTable', 'rruGsi', 'lambdaMs'] as const satisfies readonly (keyof Counters)[];
export function estimateCost(stats: Counters, prices: PriceConfig = PRICES): number | null {
  const {wruMillion:w,rruMillion:r,httpApiMillion:a,lambdaRequestsMillion:l,lambdaGbSecond:g} = prices;
  if ([w,r,a,l,g].some(v => v === null)) return null;
  return ((stats.wruTable+stats.wruGsi)*w!+(stats.rruTable+stats.rruGsi)*r!+stats.apiCalls*(a!+l!))/1e6 + stats.lambdaMs/1000*prices.lambdaMemoryGb*g!;
}

/** Same formula as estimateCost, applied to what AWS itself reported (CloudWatch). */
export function usageCost(usage: AwsUsage, prices: PriceConfig = PRICES): number | null {
  const total = (units: Record<string, number>) => Object.values(units).reduce((sum, value) => sum + value, 0);
  return estimateCost({
    wruTable: usage.wruTable, wruGsi: total(usage.wruGsi), rruTable: usage.rruTable, rruGsi: total(usage.rruGsi),
    apiCalls: Math.max(usage.apiRequests, usage.lambdaInvocations), lambdaMs: usage.lambdaMs,
  }, prices);
}

/**
 * The receipt has two payers. Requests without the admin key are the audience (phones, virtual players):
 * that part grows with the room. Everything else — LIM, regia, the meter's own writes — is one projector
 * and one console however many people join, so a projection must not multiply it.
 */
/** STATS attribute holding the audience's part of a counter, next to the total kept under the plain name. */
export const audienceField = (counter: keyof Counters) => `aud${counter[0]!.toUpperCase()}${counter.slice(1)}`;
/** null for a STATS item written before the split existed: the receipt then shows the total only. */
export function audienceCounters(item: Record<string, unknown>): Counters | null {
  if (item[audienceField('apiCalls')] === undefined) return null;
  return Object.fromEntries(COUNTERS.map(k => [k, Number(item[audienceField(k)] ?? 0)])) as unknown as Counters;
}
/** What scales with the room. Without the split the whole total is all there is to show. */
export const audienceShare = (stats: StatsResponse): CostShare => stats.audience ?? stats;
export function presenterShare(stats: StatsResponse): CostShare | null {
  const audience = stats.audience;
  if (!audience) return null;
  const rest = Object.fromEntries(COUNTERS.map(k => [k, Math.max(0, stats[k] - audience[k])])) as unknown as Counters;
  return { ...rest, estimatedCost: estimateCost(rest, stats.prices) };
}
