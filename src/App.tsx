import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router';
import type { User } from 'firebase/auth';
import { exportBackup, importShelf, parseBackup, type Notice } from './db';
import { redirectSignInResult, signIn, signOut } from './firebase';
import { ShelfProvider, useAuthUser } from './shelf';
import { downloadBlob, plural, todayISO } from './utils';
import { newerVersion, reloadInto } from './version';
import { Library } from './pages/Library';
import { BookForm } from './pages/BookForm';
import { BookDetail } from './pages/BookDetail';
import { Lists } from './pages/Lists';
import { ListDetail } from './pages/ListDetail';
import { Queue } from './pages/Queue';
import { Wishlist } from './pages/Wishlist';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <UpdateBanner />
      <AuthGate />
    </BrowserRouter>
  );
}

/**
 * Moves to a newly deployed version when the app is opened or switched back to (and every
 * half hour while open), so a phone and a desktop always run the same one. Something being
 * added or edited is never thrown away: on those pages it waits, with a banner, and reloads
 * once you leave.
 */
function UpdateBanner() {
  const { pathname } = useLocation();
  const editing = pathname === '/new' || pathname.endsWith('/edit');
  const editingRef = useRef(editing);
  editingRef.current = editing;
  // The newer version's script, once one is found
  const [latest, setLatest] = useState<string | null>(null);
  // It couldn't be loaded by reloading (see reloadInto), so leave it to the banner's button
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const found = await newerVersion();
      if (found) setLatest(found);
    };
    check();
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, 30 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (latest && !editing && !reloadInto(latest)) setStuck(true);
  }, [latest, editing]);

  if (!latest || (!editing && !stuck)) return null;
  return (
    <div className="status-banner" role="status">
      <span>
        {editing
          ? 'Shelf has been updated. It will reload when you leave this page.'
          : 'Shelf has been updated.'}
      </span>
      <button type="button" className="link-button" onClick={() => location.reload()}>
        Reload now
      </button>
    </div>
  );
}

function AuthGate() {
  const user = useAuthUser();
  if (user === undefined) return <div className="loading" aria-label="Loading" />;
  if (!user) return <SignIn />;

  return (
    <>
      <SiteHeader user={user} />
      <StatusBanners />
      <main>
        <ShelfProvider user={user}>
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/new" element={<BookForm />} />
            <Route path="/book/:id" element={<BookDetail />} />
            <Route path="/book/:id/edit" element={<BookForm />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/lists/:id" element={<ListDetail />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>Page not found</h1>
                  <Link to="/" className="btn">
                    Back to library
                  </Link>
                </div>
              }
            />
          </Routes>
        </ShelfProvider>
      </main>
      <SiteFooter />
    </>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="6" y="8" width="5" height="17" rx="1" fill="var(--orange)" />
      <rect x="13.5" y="5" width="5" height="20" rx="1" fill="var(--green)" />
      <rect x="21" y="9" width="5" height="16" rx="1" fill="var(--blue)" transform="rotate(8 23.5 17)" />
    </svg>
  );
}

function SignIn() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    redirectSignInResult().catch((err) => setError(err instanceof Error ? err.message : 'Sign-in failed.'));
  }, []);

  const onClick = async () => {
    setBusy(true);
    setError('');
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sign-in">
      <div className="sign-in-card">
        <div className="logo logo-large">
          <Logo size={44} />
          Shelf
        </div>
        <p>Track the books you read, rate them, and gather them into lists, on every device.</p>
        <button type="button" className="btn btn-primary btn-large" onClick={onClick} disabled={busy}>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function SiteHeader({ user }: { user: User }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="logo" aria-label="Shelf home">
          <Logo />
          <span className="logo-text">Shelf</span>
        </Link>
        <nav className="site-nav">
          <NavLink to="/" end>
            Books
          </NavLink>
          <NavLink to="/lists">Lists</NavLink>
          <NavLink to="/queue">Queue</NavLink>
          <NavLink to="/wishlist">Wishlist</NavLink>
        </nav>
        <Link to="/new" className="btn btn-primary log-button">
          <span aria-hidden="true">+</span> Log
        </Link>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function UserMenu({ user }: { user: User }) {
  const ref = useRef<HTMLDetailsElement>(null);

  // Close when clicking anywhere else
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();

  return (
    <details className="user-menu" ref={ref}>
      <summary aria-label="Account">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar-initial">{initial}</span>
        )}
      </summary>
      <div className="user-menu-panel">
        {user.displayName && <strong>{user.displayName}</strong>}
        <span className="muted">{user.email}</span>
        <div className="user-menu-actions">
          <Link
            to="/settings"
            className="btn btn-small"
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
          >
            Settings
          </Link>
          <button type="button" className="btn btn-small" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </details>
  );
}

/** Offline notice, errors from saves that failed in the background, and confirmations. */
function StatusBanners() {
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const onError = (e: Event) => setError((e as CustomEvent<string>).detail);
    const onNotice = (e: Event) => setNotice((e as CustomEvent<Notice>).detail);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('shelf:error', onError);
    window.addEventListener('shelf:notice', onNotice);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('shelf:error', onError);
      window.removeEventListener('shelf:notice', onNotice);
    };
  }, []);

  // Confirmations fade after a few seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <>
      {!online && (
        <div className="status-banner">You're offline. Changes are saved on this device and will sync when you reconnect.</div>
      )}
      {error && (
        <div className="status-banner error" role="alert">
          <span>Something didn't save: {error}</span>
          <button type="button" className="link-button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            <span>{notice.message}</span>
            {notice.link && (
              <Link to={notice.link.to} onClick={() => setNotice(null)}>
                {notice.link.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function SiteFooter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    setMessage('Preparing backup…');
    try {
      downloadBlob(await exportBackup(), `shelf-backup-${todayISO()}.json`);
      setMessage('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      const ok = confirm(
        `Restore ${plural(data.books.length, 'book')} and ${plural(data.lists.length, 'list')} from this backup? ` +
          'Everything currently on your shelf will be replaced.',
      );
      if (!ok) return;
      setBusy(true);
      const result = await importShelf(data, 'replace', (done, total) => setMessage(`Restoring ${done} of ${total}…`));
      setMessage(`Restored ${plural(result.books, 'book')} and ${plural(result.lists, 'list')}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="site-footer">
      <p>Your shelf is saved to your account and synced across your devices.</p>
      <div className="footer-actions">
        <button type="button" className="link-button" onClick={onExport} disabled={busy}>
          Export backup
        </button>
        <button type="button" className="link-button" onClick={() => fileRef.current?.click()} disabled={busy}>
          Restore from backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            onImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {message && (
        <p className="footer-message" role="status">
          {message}
        </p>
      )}
    </footer>
  );
}
