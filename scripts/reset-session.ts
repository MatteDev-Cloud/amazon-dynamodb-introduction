import { parseArgs } from 'node:util';
const {values}=parseArgs({options:{sid:{type:'string'},api:{type:'string',default:'http://127.0.0.1:3001'}}});
if(!values.sid||!process.env.ADMIN_KEY) throw new Error('Usage: npm run reset -- --sid new-session [--api URL]; set ADMIN_KEY');
const response=await fetch(`${values.api}/s/${encodeURIComponent(values.sid)}/admin/reset`,{method:'POST',headers:{'content-type':'application/json','x-admin-key':process.env.ADMIN_KEY},body:'{}'});
console.log(response.status,await response.text());if(!response.ok) process.exitCode=1;
