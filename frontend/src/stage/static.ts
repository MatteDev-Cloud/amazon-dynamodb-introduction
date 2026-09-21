import type { Player, RawPixel, StatsResponse } from '../../../shared/types.js';
import { PRICES, estimateCost } from '../../../shared/pricing.js';
export const examplePlayer:Player={PK:'SESSION#esempio',SK:'PLAYER#simulato',pid:'simulato',nickname:'Esempio',team:'orange',joinedAt:0,pixelsPlaced:12,score:87,expiresAt:0};
export const examplePixel:RawPixel={PK:'CANVAS#esempio',SK:'PX#012#007',x:12,y:7,color:2,by:'Esempio',byId:'simulato',cv:'esempio',updatedAt:0,expiresAt:0};
const measurements={playersJoined:40,pixelsPlaced:720,taps:3800,teamOrange:2000,teamPurple:1800,apiCalls:8400,wruTable:16000,wruGsi:7000,rruTable:13000,rruGsi:4200,lambdaMs:210000,estimated:true as const,expiresAt:0};
export const exampleStats:StatsResponse={...measurements,prices:PRICES,estimatedCost:estimateCost(measurements),costBasis:'on-demand-list-price'};
