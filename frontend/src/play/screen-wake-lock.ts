/** Keep the phone's screen awake while Play is visible; unsupported or denied requests are harmless. */
export function keepScreenAwake(): () => void {
  if (!('wakeLock' in navigator)) return () => {};
  let lock: WakeLockSentinel | undefined;
  let requesting = false;
  let stopped = false;

  async function acquire() {
    if (stopped || requesting || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
    requesting = true;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      // The page can close or move to the background while the request is pending.
      if (stopped || document.visibilityState !== 'visible') { await acquired.release(); return; }
      lock = acquired;
      acquired.addEventListener('release', () => { if (lock === acquired) lock = undefined; }, { once: true });
    } catch { /* Battery saver, browser policy or lack of support must not interrupt the game. */ }
    finally { requesting = false; }
  }
  function release() {
    const previous = lock;
    lock = undefined;
    if (previous) void previous.release().catch(() => {});
  }
  function visibilityChanged() {
    if (document.visibilityState === 'visible') void acquire();
    else release();
  }
  // Retry after returning to the page, or interacting following a system-imposed release.
  const retry = () => { void acquire(); };
  document.addEventListener('visibilitychange', visibilityChanged);
  document.addEventListener('pointerdown', retry, { passive: true });
  window.addEventListener('pagehide', release);
  window.addEventListener('pageshow', retry);
  void acquire();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', visibilityChanged);
    document.removeEventListener('pointerdown', retry);
    window.removeEventListener('pagehide', release);
    window.removeEventListener('pageshow', retry);
    release();
  };
}
