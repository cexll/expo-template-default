import { Platform } from 'react-native';
import { resolveLoopbackApiBaseUrl } from '@/config/app';
import {
  blockWebSessionBootstrap,
  clearTokens,
  clearWebSessionBootstrapBlock,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from './auth/token-storage';

const API_BASE = resolveLoopbackApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, 'http://localhost:18000');
const IS_WEB = Platform.OS === 'web';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function withCredentials(options: RequestInit): RequestInit {
  if (!IS_WEB) return options;
  return {
    ...options,
    credentials: 'include',
  };
}

export async function clearWebCookieSession(): Promise<boolean> {
  if (!IS_WEB) return true;

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/logout`, withCredentials({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));

    if (!response.ok) {
      blockWebSessionBootstrap();
      return false;
    }

    clearWebSessionBootstrapBlock();
    return true;
  } catch {
    blockWebSessionBootstrap();
    return false;
  }
}

async function clearEffectiveSession(): Promise<void> {
  await clearWebCookieSession();
  await clearTokens();
}

async function refreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      let refreshTokenBody: Record<string, string> | Record<string, never>;
      if (IS_WEB) {
        refreshTokenBody = {};
      } else {
        const token = await getRefreshToken();
        if (!token) return false;
        refreshTokenBody = { refresh_token: token };
      }

      const res = await fetch(`${API_BASE}/api/v1/auth/token/refresh`, withCredentials({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refreshTokenBody),
      }));

      if (!res.ok) return false;

      const data = await res.json();
      if (data.code !== 0) return false;

      if (!IS_WEB) {
        await saveTokens({
          accessToken: data.data.access_token,
          refreshToken: data.data.refresh_token,
          expiresIn: data.data.expires_in,
        });
      }
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!IS_WEB && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, withCredentials({ ...options, headers }));

  if (res.status === 401 && (IS_WEB || accessToken)) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const newToken = IS_WEB ? null : await getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      } else {
        delete headers['Authorization'];
      }
      res = await fetch(`${API_BASE}${path}`, withCredentials({ ...options, headers }));
    } else {
      await clearEffectiveSession();
      throw new AuthError('Session expired');
    }
  }

  const json = await res.json();

  if (!res.ok || json.code !== 0) {
    throw new ApiError(json.message || 'Request failed', json.code, res.status);
  }

  return json.data as T;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiError extends Error {
  constructor(message: string, public code: number, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = {};
    if (!IS_WEB && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    let res = await fetch(`${API_BASE}${path}`, withCredentials({
      method: 'POST',
      headers,
      body: formData,
    }));

    if (res.status === 401 && (IS_WEB || accessToken)) {
      const refreshed = await refreshToken();
      if (refreshed) {
        const newToken = IS_WEB ? null : await getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
        } else {
          delete headers['Authorization'];
        }
        res = await fetch(`${API_BASE}${path}`, withCredentials({
          method: 'POST',
          headers,
          body: formData,
        }));
      } else {
        await clearEffectiveSession();
        throw new AuthError('Session expired');
      }
    }

    const json = await res.json();
    if (!res.ok || json.code !== 0) {
      throw new ApiError(json.message || 'Upload failed', json.code, res.status);
    }
    return json.data as T;
  },
};
