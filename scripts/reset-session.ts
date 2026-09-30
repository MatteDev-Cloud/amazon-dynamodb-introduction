import { parseArgs } from 'node:util';
const {values}=parseArgs({options:{sid:{type:'string'},api:{type:'string',default:'http://127.0.0.1:3001'},endTtlMs:{type:'string'}}});
if(!values.sid||!process.env.ADMIN_KEY) throw new Error('Usage: npm run reset -- --sid new-session [--api URL] [--endTtlMs 60000]; set ADMIN_KEY');
// endTtlMs: how long the closing dissolve lasts, i.e. over how many seconds the pixel TTLs are spread.
const config=values.endTtlMs?{endTtlMs:Number(values.endTtlMs)}:{};
const response=await fetch(`${values.api}/s/${encodeURIComponent(values.sid)}/admin/reset`,{method:'POST',headers:{'content-type':'application/json','x-admin-key':process.env.ADMIN_KEY},body:JSON.stringify(config)});
console.log(response.status,await response.text());if(!response.ok) process.exitCode=1;
