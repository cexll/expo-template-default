import { Platform } from 'react-native';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TOKEN_KEY = 'auth_tokens';
const WEB_SESSION_BOOTSTRAP_BLOCK_KEY = 'web_auth_cookie_session_blocked';

type TokenChangeListener = (tokens: TokenPair | null) => void;
const tokenChangeListeners = new Set<TokenChangeListener>();

function notifyTokenChange(tokens: TokenPair | null) {
  for (const listener of tokenChangeListeners) {
    try {
      listener(tokens);
    } catch {
      // Ignore listener errors to avoid breaking auth flows.
    }
  }
}

export function subscribeTokenChanges(listener: TokenChangeListener) {
  tokenChangeListeners.add(listener);
  return () => {
    tokenChangeListeners.delete(listener);
  };
}

function canUseLocalStorage() {
  return typeof globalThis !== 'undefined' && typeof globalThis.localStorage?.getItem === 'function';
}

async function getSecureStore() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const json = JSON.stringify(tokens);
  const store = await getSecureStore();
  if (store) await store.setItemAsync(TOKEN_KEY, json);
  notifyTokenChange(tokens);
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const store = await getSecureStore();
  const json = store ? await store.getItemAsync(TOKEN_KEY) : null;
  if (!json) return null;
  try {
    const tokens: TokenPair = JSON.parse(json);
    return tokens.accessToken;
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  const store = await getSecureStore();
  const json = store ? await store.getItemAsync(TOKEN_KEY) : null;
  if (!json) return null;
  try {
    const tokens: TokenPair = JSON.parse(json);
    return tokens.refreshToken;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  if (Platform.OS === 'web') {
    notifyTokenChange(null);
    return;
  }

  const store = await getSecureStore();
  if (store) await store.deleteItemAsync(TOKEN_KEY);
  notifyTokenChange(null);
}

export function isWebSessionBootstrapBlocked(): boolean {
  if (Platform.OS !== 'web' || !canUseLocalStorage()) {
    return false;
  }

  return globalThis.localStorage.getItem(WEB_SESSION_BOOTSTRAP_BLOCK_KEY) === '1';
}

export function blockWebSessionBootstrap(): void {
  if (Platform.OS !== 'web' || !canUseLocalStorage()) {
    return;
  }

  globalThis.localStorage.setItem(WEB_SESSION_BOOTSTRAP_BLOCK_KEY, '1');
}

export function clearWebSessionBootstrapBlock(): void {
  if (Platform.OS !== 'web' || !canUseLocalStorage()) {
    return;
  }

  globalThis.localStorage.removeItem(WEB_SESSION_BOOTSTRAP_BLOCK_KEY);
}
