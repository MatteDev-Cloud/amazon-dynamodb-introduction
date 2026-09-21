import { parseArgs } from 'node:util';
import { runBots } from './games.js';
export async function main(mode:'pixel'|'hotkey'|'both',controlled=false) {
  const {values}=parseArgs({options:{sid:{type:'string'},n:{type:'string',default:'20'},api:{type:'string',default:'http://127.0.0.1:3001'}}});
  const count=Number(values.n);
  if(!values.sid||!Number.isInteger(count)||count<1||count>60)throw Error('Use --sid SESSION --n 1..60 [--api URL]');
  const controller=new AbortController();process.once('SIGINT',()=>controller.abort());
  try{await runBots(values.api!,values.sid,count,mode,controlled,undefined,controller.signal);}catch(e){if(!controller.signal.aborted)throw e;}
}
