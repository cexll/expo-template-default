import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { api, AuthError, clearWebCookieSession } from '@/lib/api';
import { saveTokens, clearTokens, getAccessToken, subscribeTokenChanges } from '@/lib/auth/token-storage';

export type AuthUser = {
  id: string;
  phone: string;
  nickname: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewUser: boolean;
  signInWithSms: (phone: string, code: string) => Promise<void>;
  signInWithWechat: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isWebPlatform() {
  return Platform.OS === 'web';
}

async function clearFailedWebBootstrapSession() {
  await clearWebCookieSession();
  await clearTokens();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (isWebPlatform() || token) {
          const me = await api.get<AuthUser>('/api/v1/auth/me');
          setUser(me);
        }
      } catch {
        await clearFailedWebBootstrapSession();
        setUser(null);
        setIsNewUser(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return subscribeTokenChanges((tokens) => {
      if (!tokens) {
        setUser(null);
        setIsNewUser(false);
      }
    });
  }, []);

  const signInWithSms = useCallback(async (phone: string, code: string) => {
    const data = await api.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      is_new_user: boolean;
    }>('/api/v1/auth/sms/verify', { phone, code });

    try {
      if (!isWebPlatform()) {
        await saveTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        });
      }

      setIsNewUser(data.is_new_user);
      const me = await api.get<AuthUser>('/api/v1/auth/me');
      setUser(me);
    } catch (err) {
      await clearFailedWebBootstrapSession();
      setUser(null);
      setIsNewUser(false);
      throw err;
    }
  }, []);

  const signInWithWechat = useCallback(async (code: string) => {
    const data = await api.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      is_new_user: boolean;
    }>('/api/v1/auth/wechat/login', { code });

    try {
      if (!isWebPlatform()) {
        await saveTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
        });
      }

      setIsNewUser(data.is_new_user);
      const me = await api.get<AuthUser>('/api/v1/auth/me');
      setUser(me);
    } catch (err) {
      await clearFailedWebBootstrapSession();
      setUser(null);
      setIsNewUser(false);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isWebPlatform()) {
      try {
        await api.post('/api/v1/auth/logout');
      } catch (error) {
        if (!(error instanceof AuthError)) {
          throw error;
        }
      }
    }

    await clearTokens();
    setUser(null);
    setIsNewUser(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    isNewUser,
    signInWithSms,
    signInWithWechat,
    signOut,
  }), [user, isLoading, isNewUser, signInWithSms, signInWithWechat, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
