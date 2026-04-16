import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/providers/auth-provider';

type ActiveProfileContextValue = {
  activeProfileId: string;
  /**
   * Set the active profile id.
   *
   * By default this persists to web storage so flows like record/save can
   * preserve continuity across navigation and reload.
   *
   * Home is a contract exception (VAL-WEB-HOME-001): it must default to the first
   * stored profile on entry/reload even if another profile was persisted.
   * Home can call this with `{ persist: false }` to avoid clobbering the
   * persisted continuity needed by other flows.
   */
  setActiveProfileId: (profileId: string, options?: { persist?: boolean }) => void;

  /**
   * Apply the Home bootstrap rule on each Home entry/re-entry: default the Home
   * screen to the first stored profile when a different (valid) profile id was
   * persisted, without overwriting that persisted id.
   */
  bootstrapHomeDefaultProfile: (profiles: { id: string }[]) => void;
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
  const profiles = profilesQuery.data;

  const [activeProfileId, setActiveProfileIdState] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [storedActiveProfileId, setStoredActiveProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated) return;
    const stored = loadStoredActiveProfileId();
    setStoredActiveProfileId(stored);
    if (stored) setActiveProfileIdState(stored);
    setHydrated(true);
  }, [hydrated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setActiveProfileIdState('');
      setStoredActiveProfileId(null);
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
    const profileList = profiles ?? [];

    if (profileList.length === 0) {
      if (activeProfileId) {
        setActiveProfileIdState('');
        clearStoredActiveProfileId();
      }
      return;
    }

    const hasActive = activeProfileId && profileList.some((profile) => profile.id === activeProfileId);
    if (hasActive) return;

    const fallbackId = profileList[0].id;
    setActiveProfileIdState(fallbackId);
    persistActiveProfileId(fallbackId);
    setStoredActiveProfileId(fallbackId);
  }, [activeProfileId, authLoading, hydrated, isAuthenticated, profiles, profilesQuery.isFetched]);

  const setActiveProfileId = useCallback((profileId: string, options?: { persist?: boolean }) => {
    const shouldPersist = options?.persist !== false;
    setActiveProfileIdState(profileId);
    if (!shouldPersist) return;

    if (profileId) {
      persistActiveProfileId(profileId);
      setStoredActiveProfileId(profileId);
      return;
    }

    clearStoredActiveProfileId();
    setStoredActiveProfileId(null);
  }, []);

  const bootstrapHomeDefaultProfile = useCallback(
    (homeProfiles: { id: string }[]) => {
      if (homeProfiles.length === 0) return;
      if (!hydrated) return;

      const firstId = homeProfiles[0].id;
      if (!firstId) return;
      if (!storedActiveProfileId) {
        return;
      }
      if (storedActiveProfileId === firstId) {
        return;
      }

      // Only override when the persisted id is valid; otherwise let the provider's
      // normal validation/repair path clear or replace the persisted value.
      const storedIsValid = homeProfiles.some((profile) => profile.id === storedActiveProfileId);
      if (!storedIsValid) {
        return;
      }

      setActiveProfileId(firstId, { persist: false });
    },
    [hydrated, setActiveProfileId, storedActiveProfileId]
  );

  const value = useMemo<ActiveProfileContextValue>(
    () => ({
      activeProfileId,
      setActiveProfileId,
      bootstrapHomeDefaultProfile,
    }),
    [activeProfileId, bootstrapHomeDefaultProfile, setActiveProfileId]
  );

  return <ActiveProfileContext.Provider value={value}>{children}</ActiveProfileContext.Provider>;
}

export function useActiveProfile() {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) throw new Error('useActiveProfile must be used within ActiveProfileProvider');
  return ctx;
}
