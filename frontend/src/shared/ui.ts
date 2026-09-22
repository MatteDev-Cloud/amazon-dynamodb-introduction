export function time(ms: number) { const secs = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`; }
export function ttlTime(ms: number) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
export const message = (error: unknown) => error instanceof Error ? error.message : 'Operazione non riuscita';
export const pixelSK = (x: number, y: number) => `PX#${String(x).padStart(3, '0')}#${String(y).padStart(3, '0')}`;
export const number = (value: number, digits = 0) => value.toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits });
export const usd = (value: number, digits = 4) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
export const clock = (ms: number) => new Date(ms).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
