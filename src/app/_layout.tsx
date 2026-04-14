import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AuthGuard } from '@/components/AuthGuard';
import { AppProviders } from '@/providers/app-providers';
import '@/global.css';

export { AppErrorBoundary as ErrorBoundary };

function installUnexpectedTextNodeConsoleFilter() {
  // react-native-web logs this warning synchronously while rendering <View />, so we must
  // install the filter at module-eval time to catch the initial render.
  if (process.env.NODE_ENV === 'test') return;
  if (typeof window === 'undefined') return;
  if (!__DEV__ || Platform.OS !== 'web') return;

  const marker = '__unexpectedTextNodeConsoleFilterInstalled';
  if ((console as any)[marker]) return;
  (console as any)[marker] = true;

  // This specific react-native-web warning is raised when an empty string is present
  // among <View /> children. It can intermittently surface as an Expo Web redbox and
  // disrupt manual QA during auth/onboarding work.
  const suppressed =
    'Unexpected text node: . A text node cannot be a child of a <View>.';
  const currentError = console.error.bind(console);

  console.error = (...args: any[]) => {
    const first = args[0];
    if (typeof first === 'string' && first === suppressed) {
      return;
    }
    currentError(...args);
  };
}

installUnexpectedTextNodeConsoleFilter();

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
