import { PALETTE, type CanvasResponse, type Meta, type Pixel } from '../../../shared/types.js';
import { Api } from './api';
import { CanvasState } from './canvas-state';
export class Wall {
  state = new CanvasState(); canvas = document.createElement('canvas');
  selected?: { x: number; y: number }; rectangle?: {x1:number;y1:number;x2:number;y2:number};
  flashes = new Map<string, number>(); optimistic?: Pixel; scale = 1; panX = 0; panY = 0; lastFull = 0; busy = false;
  onselect?: (x: number, y: number) => void; onhover?: (value: string) => void;
  pointers = new Map<number, {x:number;y:number}>(); moved = false; down?: {x:number;y:number};
  constructor(public api: Api, public meta: () => Meta | undefined, public stage = false) {
    this.canvas.setAttribute('aria-label', 'Tela condivisa: tocca una cella; trascina per spostare, due dita per ingrandire');
    this.canvas.className = 'wall'; this.canvas.width = 960; this.canvas.height = 540;
    const point = (e: PointerEvent) => ({x:e.clientX,y:e.clientY});
    this.canvas.onpointerdown = e => { this.canvas.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, point(e)); this.down=point(e); this.moved=false; };
    this.canvas.onpointermove = e => {
      const old=this.pointers.get(e.pointerId);
      if (old) {
        if (this.pointers.size === 2) {
          const other=[...this.pointers.entries()].find(([id])=>id!==e.pointerId)![1];
          this.scale=Math.max(1,Math.min(6,this.scale*Math.hypot(e.clientX-other.x,e.clientY-other.y)/Math.max(1,Math.hypot(old.x-other.x,old.y-other.y)))); this.moved=true;
        } else if (this.down && Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>8) {
          this.moved=true; if (!this.stage) { this.panX+=e.clientX-old.x; this.panY+=e.clientY-old.y; }
        }
        this.pointers.set(e.pointerId,point(e)); this.draw();
      }
      const cell=this.cell(e.clientX,e.clientY); const p=this.state.pixels.get(`${cell.x},${cell.y}`);
      this.onhover?.(p && !p.deleted ? `${p.by} · ${new Date(p.t).toLocaleTimeString('it-IT')}` : `${cell.x}, ${cell.y}`);
    };
    this.canvas.onpointerup = e => {
      if (!this.moved && this.pointers.size===1) {
        const cell=this.cell(e.clientX,e.clientY), m=this.meta();
        if(m && cell.x>=0&&cell.y>=0&&cell.x<m.canvasW&&cell.y<m.canvasH) {
          if (e.shiftKey && this.selected) this.rectangle={x1:Math.min(this.selected.x,cell.x),y1:Math.min(this.selected.y,cell.y),x2:Math.max(this.selected.x,cell.x),y2:Math.max(this.selected.y,cell.y)};
          else {this.selected=cell;this.rectangle=undefined;this.onselect?.(cell.x,cell.y);} this.draw();
        }
      }
      this.pointers.delete(e.pointerId);
    };
    this.canvas.onpointercancel=e=>this.pointers.delete(e.pointerId);
    this.canvas.onwheel=e=>{e.preventDefault();this.scale=Math.max(1,Math.min(6,this.scale*(e.deltaY<0?1.15:1/1.15)));this.draw();};
  }
  cell(x:number,y:number) {
    const r=this.canvas.getBoundingClientRect(),m=this.meta();
    return {x:Math.floor(((x-r.left-this.panX)/r.width-.5)/this.scale*(m?.canvasW||48)+(m?.canvasW||48)/2),y:Math.floor(((y-r.top-this.panY)/r.height-.5)/this.scale*(m?.canvasH||27)+(m?.canvasH||27)/2)};
  }
  resetView(){this.scale=1;this.panX=this.panY=0;this.draw();}
  async refresh(force=false) {
    if(this.busy || !this.meta())return;
    this.busy=true;
    try {
      const full=force || !this.api.online || Date.now()-this.lastFull>=15000 || this.state.revision<0;
      const data=await this.api.call<CanvasResponse>(full?'/canvas':`/canvas/changes?since=${this.state.cursor}&revision=${this.state.revision}`);
      if(this.stage&&!data.full)for(const p of data.pixels){const old=this.state.pixels.get(`${p.x},${p.y}`);if(!old||p.t>old.t)this.flashes.set(`${p.x},${p.y}`,performance.now());}
      this.state.apply(data); if(full)this.lastFull=Date.now(); this.draw();
    } finally {this.busy=false;}
  }
  draw() {
    const m=this.meta();if(!m)return;
    const ctx=this.canvas.getContext('2d')!,w=this.canvas.width,h=this.canvas.height;
    ctx.fillStyle='#15181D';ctx.fillRect(0,0,w,h);
    if(m.canvasHidden||this.state.hidden){ctx.fillStyle='#8A9099';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText('Tela temporaneamente nascosta',w/2,h/2);return;}
    const r=this.canvas.getBoundingClientRect();ctx.save();ctx.translate(w/2+this.panX*w/(r.width||w),h/2+this.panY*h/(r.height||h));ctx.scale(this.scale,this.scale);ctx.translate(-w/2,-h/2);
    const cw=w/m.canvasW,ch=h/m.canvasH;
    ctx.strokeStyle='#252A32';ctx.lineWidth=.5;
    for(let x=0;x<=m.canvasW;x++){ctx.beginPath();ctx.moveTo(x*cw,0);ctx.lineTo(x*cw,h);ctx.stroke();}
    for(let y=0;y<=m.canvasH;y++){ctx.beginPath();ctx.moveTo(0,y*ch);ctx.lineTo(w,y*ch);ctx.stroke();}
    const paint=(p:Pixel,alpha=1)=>{if(p.deleted)return;ctx.globalAlpha=alpha;ctx.fillStyle=PALETTE[p.c];ctx.fillRect(p.x*cw+1,p.y*ch+1,cw-2,ch-2);};
    for(const p of this.state.pixels.values())paint(p);
    if(this.optimistic)paint(this.optimistic,.5);ctx.globalAlpha=1;
    if(this.selected){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(this.selected.x*cw,this.selected.y*ch,cw,ch);}
    if(this.rectangle){const a=this.rectangle;ctx.strokeStyle='#FF4D6D';ctx.lineWidth=3;ctx.strokeRect(a.x1*cw,a.y1*ch,(a.x2-a.x1+1)*cw,(a.y2-a.y1+1)*ch);}
    ctx.restore();
    if(this.flashes.size){let active=false;ctx.save();ctx.translate(w/2+this.panX*w/(r.width||w),h/2+this.panY*h/(r.height||h));ctx.scale(this.scale,this.scale);ctx.translate(-w/2,-h/2);for(const [key,start] of this.flashes){const age=performance.now()-start;if(age>=300){this.flashes.delete(key);continue;}active=true;const [x,y]=key.split(',').map(Number);ctx.globalAlpha=1-age/300;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(x*cw,y*ch,cw,ch);}ctx.restore();if(active)requestAnimationFrame(()=>this.draw());}
  }
}
