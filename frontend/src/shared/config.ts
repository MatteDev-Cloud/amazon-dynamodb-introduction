const query = new URLSearchParams(location.search);
export const config = {
  sid: query.get('s') || import.meta.env.VITE_SESSION || 'prova-01',
  api: query.get('api') === 'local' ? `http://${location.hostname}:3001` : query.get('api') || import.meta.env.VITE_API_BASE || `http://${location.hostname}:3001`,
  mock: query.get('mode') === 'mock', static: query.get('mode') === 'static',
  document: import.meta.env.VITE_DOCUMENT_URL || '/dynamolive-approfondimento.pdf',
  backup: import.meta.env.VITE_BACKUP_URL || '/backup.mp4',
};
// Credentials are scoped to both environment and session; no cross-environment recovery.
export const scope = `${config.mock ? 'mock' : config.api}:${config.sid}`;
export const playerKey = `dynamolive:player:${scope}`;
export const adminKey = `dynamolive:admin:${scope}`;
export function playUrl() {
  const url = new URL('/play', import.meta.env.VITE_PUBLIC_ORIGIN || location.origin);
  url.searchParams.set('s', config.sid); url.searchParams.set('api', config.api);
  if (config.mock) url.searchParams.set('mode', 'mock');
  return url.href;
}
export const read = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
export const save = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
