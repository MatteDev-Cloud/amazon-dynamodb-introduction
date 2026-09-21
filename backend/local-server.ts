import { createServer } from 'node:http';
import { createApp } from './src/app.js';
import { configuration } from './src/lib/config.js';
const app=createApp(configuration());
const server=createServer(async (req,res)=>{
  try {
    const url=new URL(req.url??'/', 'http://localhost');
    let raw='';
    for await (const chunk of req) { raw+=chunk; if(Buffer.byteLength(raw)>16384) { res.writeHead(413,{'content-type':'application/json'});res.end(JSON.stringify({error:'BODY_TOO_LARGE',serverTime:Date.now()}));return; } }
    let body;
    try { body=raw?JSON.parse(raw):undefined; } catch { res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:'INVALID_JSON',message:'Invalid JSON body',serverTime:Date.now()}));return; }
    const output=await app({method:req.method??'GET',path:url.pathname,headers:Object.fromEntries(Object.entries(req.headers).map(([k,v])=>[k,Array.isArray(v)?v[0]:v])),query:Object.fromEntries(url.searchParams),body});
    res.writeHead(output.statusCode,output.headers);res.end(output.body);
  } catch { res.writeHead(500);res.end(); }
});
server.listen(Number(process.env.PORT??3001),process.env.HOST??'127.0.0.1',()=>console.log(`DynamoLive API ready on http://${process.env.HOST??'127.0.0.1'}:${process.env.PORT??3001}`));
