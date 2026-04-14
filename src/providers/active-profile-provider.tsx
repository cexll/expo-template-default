import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/providers/auth-provider';

type ActiveProfileContextValue = {
  activeProfileId: string;
  setActiveProfileId: (profileId: string) => void;
};

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null);

const STORAGE_KEY = 'active_profile_id';

async function getSecureStore() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

async function loadStoredActiveProfileId(): Promise<string | null> {
  const store = await getSecureStore();
  if (store) {
    return (await store.getItemAsync(STORAGE_KEY)) ?? null;
  }
  return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
}

async function persistActiveProfileId(profileId: string): Promise<void> {
  const store = await getSecureStore();
  if (store) {
    await store.setItemAsync(STORAGE_KEY, profileId);
    return;
  }
  globalThis.localStorage?.setItem(STORAGE_KEY, profileId);
}

async function clearStoredActiveProfileId(): Promise<void> {
  const store = await getSecureStore();
  if (store) {
    await store.deleteItemAsync(STORAGE_KEY);
    return;
  }
  globalThis.localStorage?.removeItem(STORAGE_KEY);
}

export function ActiveProfileProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { data: profiles = [] } = useProfiles({ enabled: isAuthenticated });

  const [activeProfileId, setActiveProfileIdState] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isAuthenticated) {
        setActiveProfileIdState('');
        setHydrated(true);
        await clearStoredActiveProfileId();
        return;
      }

      setHydrated(false);
      const stored = await loadStoredActiveProfileId();
      if (cancelled) return;
      if (stored) setActiveProfileIdState(stored);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!hydrated) return;
    if (profiles.length === 0) {
      if (activeProfileId) setActiveProfileIdState('');
      return;
    }

    const hasActive = activeProfileId && profiles.some((profile) => profile.id === activeProfileId);
    if (hasActive) return;

    const fallbackId = profiles[0].id;
    setActiveProfileIdState(fallbackId);
    void persistActiveProfileId(fallbackId);
  }, [activeProfileId, hydrated, isAuthenticated, profiles]);

  const setActiveProfileId = useCallback((profileId: string) => {
    setActiveProfileIdState(profileId);
    if (profileId) {
      void persistActiveProfileId(profileId);
    }
  }, []);

  const value = useMemo<ActiveProfileContextValue>(
    () => ({
      activeProfileId,
      setActiveProfileId,
    }),
    [activeProfileId, setActiveProfileId]
  );

  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

export function useActiveProfile() {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) throw new Error('useActiveProfile must be used within ActiveProfileProvider');
  return ctx;
}
