import { useEffect, useMemo } from 'react';
import { router, usePathname, useSegments } from 'expo-router';

import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/providers/auth-provider';

function getRootSegment(segments: string[]) {
  return segments.length > 0 ? segments[0] : '';
}

function isAuthRoute(segments: string[]) {
  return getRootSegment(segments) === '(auth)';
}

function isOnboardingRoute(segments: string[]) {
  return isAuthRoute(segments) && segments[1] === 'onboarding';
}

function normalizePathname(pathname: string | null) {
  if (!pathname) return '';
  return pathname.replace(/\/+$/, '') || '/';
}

export function AuthGuard() {
  const segments = useSegments();
  const pathname = normalizePathname(usePathname());
  const { isAuthenticated, isLoading: authLoading, isNewUser } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useProfiles({ enabled: isAuthenticated });

  const rootSegment = useMemo(() => getRootSegment(segments), [segments]);
  const inAuthGroup = rootSegment === '(auth)' || pathname === '/login' || pathname === '/onboarding';
  const onboardingRoute = isOnboardingRoute(segments) || pathname === '/onboarding';

  const profileCount = profiles?.length ?? 0;
  const needsOnboarding = useMemo(() => {
    if (!isAuthenticated) return false;
    if (!profilesLoading) return profileCount === 0;
    return isNewUser;
  }, [isAuthenticated, isNewUser, profileCount, profilesLoading]);
  const onboardingDecisionReady = useMemo(() => {
    if (!isAuthenticated) return true;
    return isNewUser || !profilesLoading;
  }, [isAuthenticated, isNewUser, profilesLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!rootSegment && !pathname) return;

    if (!isAuthenticated) {
      if (onboardingRoute) router.replace('/(auth)/login');
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (!onboardingDecisionReady) return;

    if (needsOnboarding) {
      if (!onboardingRoute) router.replace('/(auth)/onboarding');
      return;
    }

    if (inAuthGroup) router.replace('/(main)');
  }, [
    authLoading,
    inAuthGroup,
    isAuthenticated,
    needsOnboarding,
    onboardingDecisionReady,
    onboardingRoute,
    pathname,
    rootSegment,
    segments,
  ]);

  return null;
}
