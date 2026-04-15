import { Stack } from 'expo-router';
import React from 'react';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AuthGuard } from '@/components/AuthGuard';
import { AppProviders } from '@/providers/app-providers';
import '@/global.css';

export { AppErrorBoundary as ErrorBoundary };

export default function RootLayout() {
  return (
    <AppProviders>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="lesion/[id]" />
        <Stack.Screen name="record/upload" />
        <Stack.Screen name="record/recognize" />
        <Stack.Screen name="record/match" />
        <Stack.Screen name="summary/[profileId]" />
        <Stack.Screen name="subscription/index" />
        <Stack.Screen name="subscription/success" />
        <Stack.Screen name="entry/[slug]" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AppProviders>
  );
}
