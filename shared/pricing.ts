import type { PriceConfig, Stats } from './types.js';
/** Do not substitute unverified US prices for Frankfurt prices. */
export const PRICES: PriceConfig = {
  region: 'eu-central-1', currency: 'USD', verifiedAt: '2026-09-21',
  source: 'https://aws.amazon.com/dynamodb/pricing/on-demand/',
  wruMillion: 0.7625, rruMillion: 0.1525, httpApiMillion: 1.2,
  lambdaRequestsMillion: 0.2, lambdaGbSecond: 0.0000133334, lambdaMemoryGb: 0.25,
};
export function estimateCost(stats: Stats, prices: PriceConfig = PRICES): number | null {
  const {wruMillion:w,rruMillion:r,httpApiMillion:a,lambdaRequestsMillion:l,lambdaGbSecond:g} = prices;
  if ([w,r,a,l,g].some(v => v === null)) return null;
  return ((stats.wruTable+stats.wruGsi)*w!+(stats.rruTable+stats.rruGsi)*r!+stats.apiCalls*(a!+l!))/1e6 + stats.lambdaMs/1000*prices.lambdaMemoryGb*g!;
}
