import React from 'react';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/tw';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f6f2' }}>
      <View className="flex-1 items-center justify-center bg-ink-50 px-6">
        <View className="w-full rounded-[32px] bg-white px-6 py-8">
          <Text className="text-xs uppercase tracking-[2px] text-ink-400">404</Text>
          <Text className="mt-3 font-rounded text-3xl font-semibold text-ink-900">
            页面不存在
          </Text>
          <Text className="mt-3 text-base leading-7 text-ink-400">
            这个脚手架已经接好路由级错误页，你可以直接在这里扩展空状态和日志上报。
          </Text>
          <Link href="/" style={{ marginTop: 24 }}>
            返回首页
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
