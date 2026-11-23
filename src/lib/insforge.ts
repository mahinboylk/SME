import { createClient } from '@insforge/sdk';
import type { AuthSession, UserSchema } from '@insforge/sdk';

const isDev = import.meta.env.DEV;
const insforgeUrl = isDev
  ? window.location.origin
  : `https://${import.meta.env.VITE_INSFORGE_PROJECT_ID}.insforge.app`;

export const insforge = createClient({
  baseUrl: insforgeUrl,
  anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY,
});

// Internal SDK shapes we reach into for session persistence.
interface TokenManagerLike {
  accessToken: string | null;
  user: unknown;
  saveSession: (session: unknown, event?: string) => void;
  clearSession: (...args: unknown[]) => void;
}

interface InsforgeHttpLike {
  refreshToken?: string | null;
  setAuthToken?: (token: string) => void;
  setRefreshToken?: (token: string) => void;
}

interface AiChatCompletionsLike {
  create: (...args: unknown[]) => Promise<unknown>;
}

interface InsforgeInternals {
  auth: { tokenManager: TokenManagerLike };
  http: InsforgeHttpLike;
  ai: { chat: { completions: AiChatCompletionsLike } };
}

declare global {
  interface Window {
    __insforge?: typeof insforge;
  }
}

// Exposed on window for local debugging only — never in production builds.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__insforge = insforge;
}

// --- Session persistence across full page reloads ---
// The SDK's default TokenManager is in-memory only, so a refresh wipes the
// session and the user is forced to sign in again. Persist the session to
// localStorage and restore it into the SDK on load so a page refresh keeps the
// user signed in. (In production the SDK additionally refreshes via an httpOnly
// cookie; the proxy below rewrites that cookie's domain for dev as well.)
if (typeof window !== 'undefined') {
  const STORAGE_KEY = 'insforge_session';
  const internals = insforge as unknown as InsforgeInternals;
  const tm = internals.auth.tokenManager;
  const http = internals.http;

  const persist = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accessToken: tm.accessToken,
          user: tm.user,
          refreshToken: http?.refreshToken ?? null,
        }),
      );
    } catch {
      /* ignore */
    }
  };
  const clear = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const origSave = tm.saveSession.bind(tm);
  tm.saveSession = (session: unknown, event?: string) => {
    origSave(session, event);
    persist();
  };
  const origClear = tm.clearSession.bind(tm);
  tm.clearSession = (...args: unknown[]) => {
    origClear(...args);
    clear();
  };

  // Restore on load
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as { accessToken?: string; user?: unknown; refreshToken?: string };
      if (s.accessToken && s.user) {
        tm.accessToken = s.accessToken;
        tm.user = s.user;
        http?.setAuthToken?.(s.accessToken);
        if (s.refreshToken) http?.setRefreshToken?.(s.refreshToken);
      }
    }
  } catch {
    /* ignore */
  }
}

export type Session = AuthSession;
export type User = UserSchema;
