import { Platform } from 'react-native';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TOKEN_KEY = 'auth_tokens';

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

async function getSecureStore() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

const WEB_DB_NAME = 'nodule_archive';
const WEB_STORE_NAME = 'kv';

let webDbPromise: Promise<IDBDatabase> | null = null;
let webMemory: string | null = null;

function openWebDb(): Promise<IDBDatabase> {
  if (webDbPromise) return webDbPromise;

  webDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(WEB_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WEB_STORE_NAME)) {
        db.createObjectStore(WEB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
  });

  return webDbPromise;
}

async function webRequest<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openWebDb();
  return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(WEB_STORE_NAME, mode);
    const store = tx.objectStore(WEB_STORE_NAME);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
  });
}

async function webSetItem(key: string, value: string): Promise<void> {
  webMemory = value;
  try {
    await webRequest('readwrite', (store) => store.put(value, key));
  } catch {
    // best-effort persistence; memory fallback already set
  }
}

async function webGetItem(key: string): Promise<string | null> {
  try {
    const value = await webRequest('readonly', (store) => store.get(key));
    if (typeof value === 'string') return value;
  } catch {
    // best-effort; fall through to memory
  }
  return webMemory;
}

async function webRemoveItem(key: string): Promise<void> {
  webMemory = null;
  try {
    await webRequest('readwrite', (store) => store.delete(key));
  } catch {
    // best-effort; memory cleared already
  }
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  const json = JSON.stringify(tokens);
  if (Platform.OS === 'web') {
    await webSetItem(TOKEN_KEY, json);
    notifyTokenChange(tokens);
    return;
  }

  const store = await getSecureStore();
  if (store) await store.setItemAsync(TOKEN_KEY, json);
  notifyTokenChange(tokens);
}

export async function getAccessToken(): Promise<string | null> {
  let json: string | null;

  if (Platform.OS === 'web') {
    json = await webGetItem(TOKEN_KEY);
  } else {
    const store = await getSecureStore();
    json = store ? await store.getItemAsync(TOKEN_KEY) : null;
  }

  if (!json) return null;
  try {
    const tokens: TokenPair = JSON.parse(json);
    return tokens.accessToken;
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  let json: string | null;

  if (Platform.OS === 'web') {
    json = await webGetItem(TOKEN_KEY);
  } else {
    const store = await getSecureStore();
    json = store ? await store.getItemAsync(TOKEN_KEY) : null;
  }

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
    await webRemoveItem(TOKEN_KEY);
    notifyTokenChange(null);
    return;
  }

  const store = await getSecureStore();
  if (store) await store.deleteItemAsync(TOKEN_KEY);
  notifyTokenChange(null);
}
