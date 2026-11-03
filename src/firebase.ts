import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// The local cache makes the app open instantly and keep working offline; changes made
// offline are sent once the connection is back.
export const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// Phones and home-screen apps handle popups poorly, so they use a full-page redirect.
// That works because the app is served from the same domain as the sign-in handler
// (see the web.app → firebaseapp.com redirect in main.tsx).
const preferRedirect =
  window.matchMedia('(display-mode: standalone)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export async function signIn(): Promise<void> {
  if (preferRedirect) {
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      throw err;
    }
  }
}

/** Surfaces an error from a sign-in redirect that just returned to the app, if any. */
export function redirectSignInResult() {
  return getRedirectResult(auth);
}

export function signOut() {
  return firebaseSignOut(auth);
}
