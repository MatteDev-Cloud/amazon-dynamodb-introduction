import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createApp } from './app.js';
import { configuration } from './lib/config.js';
const app=createApp(configuration());
export const handler: APIGatewayProxyHandlerV2 = async event => {
  let body: unknown;
  try { body=event.body ? JSON.parse(event.isBase64Encoded?Buffer.from(event.body,'base64').toString():event.body) : undefined; }
  catch { return {statusCode:400,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error:'INVALID_JSON',message:'Invalid JSON body',serverTime:Date.now()})}; }
  return app({method:event.requestContext.http.method,path:event.rawPath,headers:event.headers,query:event.queryStringParameters??{},body});
};
