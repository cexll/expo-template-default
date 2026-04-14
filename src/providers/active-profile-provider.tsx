import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/providers/auth-provider';

type ActiveProfileContextValue = {
  activeProfileId: string;
  setActiveProfileId: (profileId: string) => void;
};

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(null);
const STORAGE_KEY = 'active_profile_id';

function loadStoredActiveProfileId(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function persistActiveProfileId(profileId: string) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, profileId);
  } catch {
    // ignore
  }
}

function clearStoredActiveProfileId() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function ActiveProfileProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const profilesQuery = useProfiles({ enabled: isAuthenticated && !authLoading });
  const profiles = profilesQuery.data ?? [];

  const [activeProfileId, setActiveProfileIdState] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    const stored = loadStoredActiveProfileId();
    if (stored) setActiveProfileIdState(stored);
    setHydrated(true);
  }, [hydrated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setActiveProfileIdState('');
      clearStoredActiveProfileId();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!hydrated) return;
    if (authLoading) return;
    if (!isAuthenticated) return;
    // Avoid clobbering a persisted active selection while profiles are still loading.
    // Once the profiles query is fetched, we can safely validate/repair the active id.
    if (!profilesQuery.isFetched) return;
    if (profiles.length === 0) {
      if (activeProfileId) {
        setActiveProfileIdState('');
        clearStoredActiveProfileId();
      }
      return;
    }

    const hasActive = activeProfileId && profiles.some((profile) => profile.id === activeProfileId);
    if (hasActive) return;

    const fallbackId = profiles[0].id;
    setActiveProfileIdState(fallbackId);
    persistActiveProfileId(fallbackId);
  }, [activeProfileId, authLoading, hydrated, isAuthenticated, profiles, profilesQuery.isFetched]);

  const setActiveProfileId = useCallback((profileId: string) => {
    setActiveProfileIdState(profileId);
    if (profileId) {
      persistActiveProfileId(profileId);
    } else {
      clearStoredActiveProfileId();
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
