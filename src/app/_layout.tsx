import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AuthGuard } from '@/components/AuthGuard';
import { AppProviders } from '@/providers/app-providers';
import '@/global.css';

export { AppErrorBoundary as ErrorBoundary };

export default function RootLayout() {
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'web') return;

    LogBox.ignoreLogs([
      'Unexpected text node: . A text node cannot be a child of a <View>.',
    ]);

    const currentError = console.error;
    const filtered = (...args: any[]) => {
      const first = args[0];
      if (
        typeof first === 'string' &&
        first === 'Unexpected text node: . A text node cannot be a child of a <View>.'
      ) {
        return;
      }
      currentError(...args);
    };

    try {
      Object.defineProperty(console, 'error', {
        configurable: true,
        writable: false,
        value: filtered,
      });
    } catch {
      // Best-effort fallback; some environments may disallow redefining console methods.
      console.error = filtered;
    }

    return () => {
      try {
        Object.defineProperty(console, 'error', {
          configurable: true,
          writable: true,
          value: currentError,
        });
      } catch {
        console.error = currentError;
      }
    };
  }, []);

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
