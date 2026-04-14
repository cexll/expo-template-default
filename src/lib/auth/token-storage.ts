import { Platform } from 'react-native';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TOKEN_KEY = 'auth_tokens';

async function getSecureStore() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  const json = JSON.stringify(tokens);
  const store = await getSecureStore();
  if (store) {
    await store.setItemAsync(TOKEN_KEY, json);
  } else {
    localStorage.setItem(TOKEN_KEY, json);
  }
}

export async function getAccessToken(): Promise<string | null> {
  const store = await getSecureStore();
  let json: string | null;
  if (store) {
    json = await store.getItemAsync(TOKEN_KEY);
  } else {
    json = localStorage.getItem(TOKEN_KEY);
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
  const store = await getSecureStore();
  let json: string | null;
  if (store) {
    json = await store.getItemAsync(TOKEN_KEY);
  } else {
    json = localStorage.getItem(TOKEN_KEY);
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
  const store = await getSecureStore();
  if (store) {
    await store.deleteItemAsync(TOKEN_KEY);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
