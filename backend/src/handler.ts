import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { createApp } from './app.js';
import { loadConfiguration } from './lib/config.js';

const json = (statusCode: number, data: Record<string, unknown>) => ({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({...data,serverTime:Date.now()})});
// Configuration (and the admin key from SSM) is loaded once per container; a failed load is retried on the next request.
let app: Promise<ReturnType<typeof createApp>> | undefined;
function ready() {
  app ??= loadConfiguration().then(createApp).catch(error => {
    app = undefined;
    console.error(JSON.stringify({event:'config_error',type:error instanceof Error?error.name:'UnknownError'}));
    throw error;
  });
  return app;
}

export const handler: APIGatewayProxyHandlerV2 = async event => {
  let body: unknown;
  try { body=event.body ? JSON.parse(event.isBase64Encoded?Buffer.from(event.body,'base64').toString():event.body) : undefined; }
  catch { return json(400,{error:'INVALID_JSON',message:'Invalid JSON body'}); }
  let handle: Awaited<ReturnType<typeof ready>>;
  try { handle=await ready(); }
  catch { return json(503,{error:'CONFIG_UNAVAILABLE',message:'Backend configuration not available; retry shortly',retryInMs:1000}); }
  return handle({method:event.requestContext.http.method,path:event.rawPath,headers:event.headers,query:event.queryStringParameters??{},body});
};
