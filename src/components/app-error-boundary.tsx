import type { ErrorBoundaryProps } from 'expo-router';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Pressable, Text, View } from '@/tw';

export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f6f2' }}>
      <View className="flex-1 bg-ink-50 px-4 pt-5">
        <View className="rounded-[32px] bg-white px-6 py-8">
          <Text className="text-xs uppercase tracking-[2px] text-ink-400">runtime error</Text>
          <Text className="mt-3 font-rounded text-3xl font-semibold text-ink-900">
            页面发生错误
          </Text>
          <Text className="mt-3 text-base leading-7 text-ink-400">
            {error.message || 'Unexpected error'}
          </Text>
          <Pressable className="mt-6 rounded-2xl bg-brand-500 px-4 py-3" onPress={retry}>
            <Text className="text-center text-base font-medium text-white">重试</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
