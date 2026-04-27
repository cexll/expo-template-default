import { useEffect, useMemo } from 'react';
import { router, usePathname, useSegments } from 'expo-router';

import { useProfiles } from '@/hooks/useProfiles';
import { hasPrototypeSeedParam } from '@/lib/prototype-review';
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

function isPrototypeReviewRoute(pathname: string) {
  return pathname === '/record/upload' || pathname === '/record/recognize' || pathname === '/record/match';
}

function isPrototypeHomeReviewRoute(pathname: string) {
  return pathname === '/' && hasPrototypeSeedParam('prototypeHomeSeed');
}

function isPrototypeDetailReviewRoute(pathname: string) {
  return /^\/lesion\/[^/]+(?:\/compare)?$/.test(pathname) && hasPrototypeSeedParam('prototypeDetailSeed');
}

function isPrototypeUi005ReviewRoute(pathname: string) {
  if (!hasPrototypeSeedParam('prototypeUi005Seed')) return false;
  return (
    /^\/summary\/[^/]+$/.test(pathname) ||
    pathname === '/paywall' ||
    pathname === '/reminders' ||
    pathname === '/settings' ||
    pathname === '/subscription' ||
    pathname === '/subscription/success'
  );
}

export function AuthGuard() {
  const segments = useSegments();
  const pathname = normalizePathname(usePathname());
  const { isAuthenticated, isLoading: authLoading, isNewUser } = useAuth();
  const { data: profiles, isLoading: profilesLoading } = useProfiles({ enabled: isAuthenticated });

  const rootSegment = useMemo(() => getRootSegment(segments), [segments]);
  const prototypeReviewRoute = isPrototypeReviewRoute(pathname);
  const prototypeHomeReviewRoute = isPrototypeHomeReviewRoute(pathname);
  const prototypeDetailReviewRoute = isPrototypeDetailReviewRoute(pathname);
  const prototypeUi005ReviewRoute = isPrototypeUi005ReviewRoute(pathname);
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
      if (!inAuthGroup && !prototypeHomeReviewRoute && !prototypeReviewRoute && !prototypeDetailReviewRoute && !prototypeUi005ReviewRoute) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (!onboardingDecisionReady) return;

    if (needsOnboarding) {
      if (!onboardingRoute && !prototypeHomeReviewRoute && !prototypeReviewRoute && !prototypeDetailReviewRoute && !prototypeUi005ReviewRoute) {
        router.replace('/(auth)/onboarding');
      }
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
    prototypeDetailReviewRoute,
    prototypeHomeReviewRoute,
    prototypeReviewRoute,
    prototypeUi005ReviewRoute,
    rootSegment,
    segments,
  ]);

  return null;
}
