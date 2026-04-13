import { Stack } from 'expo-router';
import React from 'react';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AppProviders } from '@/providers/app-providers';
import '@/global.css';

export { AppErrorBoundary as ErrorBoundary };

export default function TabLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="entry/[slug]" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AppProviders>
  );
}
