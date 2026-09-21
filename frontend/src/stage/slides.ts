import type { Phase } from '../../../shared/types.js';
export const scenes: {id:string;number?:number;title:string;phase:Phase;time:string}[] = [
{id:'lobby',number:1,title:'Tirate fuori il telefono.',phase:'lobby',time:'00:00'},
{id:'pixel',title:'PIXEL WALL',phase:'pixel',time:'01:00'},
{id:'history',number:2,title:'Natale 2004.',phase:'pixel_frozen',time:'02:30'},
{id:'you',number:3,title:'Questo sei tu.',phase:'pixel_frozen',time:'03:30'},
{id:'keys',number:4,title:'La chiave decide dove vivi.',phase:'talk',time:'04:30'},
{id:'patterns',number:5,title:'Prima le domande.',phase:'talk',time:'06:00'},
{id:'architecture',number:6,title:'Zero server (nostri).',phase:'hotkey_ready',time:'07:00'},
{id:'hotkey',title:'HOT KEY',phase:'hotkey_running',time:'07:30'},
{id:'cost',number:7,title:'Cosa è appena successo.',phase:'hotkey_end',time:'10:00'},
{id:'choice',number:8,title:'Non è più semplice. È complesso in un momento diverso.',phase:'hotkey_end',time:'11:30'},
{id:'end',title:'Il ricordo resta. I dati scadono.',phase:'end',time:'13:00'},
];
