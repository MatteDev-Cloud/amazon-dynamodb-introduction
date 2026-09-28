const query = new URLSearchParams(location.search);

/** Page parameters → session, API base and mode. Same rules for the current page and for navigation targets. */
function resolve(params: URLSearchParams) {
  const api = params.get('api');
  return {
    sid: params.get('s') || import.meta.env.VITE_SESSION || 'prova-01',
    api: api === 'local' ? `http://${location.hostname}:3001` : api || import.meta.env.VITE_API_BASE || `http://${location.hostname}:3001`,
    mock: params.get('mode') === 'mock', static: params.get('mode') === 'static',
  };
}
const scopeOf = (r: ReturnType<typeof resolve>) => `${r.mock ? 'mock' : r.api}:${r.sid}`;

export const config = {
  ...resolve(query),
  document: import.meta.env.VITE_DOCUMENT_URL || '/dynamolive-approfondimento.pdf',
  backup: import.meta.env.VITE_BACKUP_URL || '/backup.mp4',
};
// Credentials are scoped to both environment and session; no cross-environment recovery.
export const scope = scopeOf(config);
export const playerKey = `dynamolive:player:${scope}`;
export const adminKey = `dynamolive:admin:${scope}`;
/** Stage (LIM) and Regia (second screen) talk over this channel: same browser, same origin. */
export const channelName = `dynamolive:channel:${scope}`;

/** Where the data lives, as shown to the presenter. */
export const backend = config.static ? { kind: 'static', label: 'Statico · nessuna API' }
  : config.mock ? { kind: 'mock', label: 'Simulato nel browser' }
  : /\.execute-api\.[a-z0-9-]+\.amazonaws\.com/.test(config.api) ? { kind: 'aws', label: `AWS · ${/execute-api\.([a-z0-9-]+)\./.exec(config.api)![1]}` }
  : { kind: 'local', label: `Locale · ${new URL(config.api).host}` };

/**
 * Reloads this page with some parameters changed (null removes one).
 * With keepKey the admin key follows a change of sid on the same API; a different API needs its own key.
 */
export function navigate(params: Record<string, string | null>, keepKey?: string) {
  const url = new URL(location.href);
  for (const [name, value] of Object.entries(params)) if (value === null) url.searchParams.delete(name); else url.searchParams.set(name, value);
  const target = resolve(url.searchParams);
  if (keepKey && target.api === config.api) sessionStorage.setItem(`dynamolive:admin:${scopeOf(target)}`, keepKey);
  location.assign(url.href);
}

export function playUrl() {
  const url = new URL('/play', import.meta.env.VITE_PUBLIC_ORIGIN || location.origin);
  url.searchParams.set('s', config.sid); url.searchParams.set('api', config.api);
  if (config.mock) url.searchParams.set('mode', 'mock');
  return url.href;
}
export function regiaUrl() {
  const url = new URL('/regia', location.origin);
  for (const key of ['s', 'api']) { const value = query.get(key); if (value) url.searchParams.set(key, value); }
  // The Regia of a static LIM stays live: it keeps the real session and can bring the LIM back.
  if (config.mock) url.searchParams.set('mode', 'mock');
  return url.href;
}
export const read = <T>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
export const save = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: state stays in memory */ } };
