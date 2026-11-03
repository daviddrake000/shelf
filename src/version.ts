// Keeps an app that stays open for days (a phone's home-screen app, a desktop tab) on the
// latest deploy. Every build names its entry script after its contents, so comparing the one
// this page started with against the one the live page names shows whether a new version is
// out. Without this, a phone could keep running an old version, and saving from it could
// drop fields that only newer versions know about.

// e.g. "/assets/index-B9zLTcG3.js"; in development there's nothing to compare
const running = import.meta.env.PROD
  ? document.querySelector('script[type="module"][src]')?.getAttribute('src')
  : null;

/** The entry script of the deployed version when it differs from the running one, else null. */
export async function newerVersion(): Promise<string | null> {
  if (!running) return null;
  try {
    const html = await (await fetch('/', { cache: 'no-store' })).text();
    const latest = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0];
    return latest && latest !== running ? latest : null;
  } catch {
    // Offline: check again later
    return null;
  }
}

/**
 * Reloads into `latest`, at most once per version: if the reload still brings back the old
 * page (a cached copy), it isn't tried again, so the page can't reload over and over.
 * Returns false when it didn't reload.
 */
export function reloadInto(latest: string): boolean {
  try {
    if (sessionStorage.getItem('shelf:reloaded-for') === latest) return false;
    sessionStorage.setItem('shelf:reloaded-for', latest);
  } catch {
    // Storage blocked: reload anyway
  }
  location.reload();
  return true;
}
