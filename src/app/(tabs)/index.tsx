import React from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Section } from '@/components/wechat-ui';
import { appConfig } from '@/config/app';
import { chatThreads } from '@/data/wechat';
import { fetchJson } from '@/lib/api/client';
import { Pressable, ScrollView, Text, View } from '@/tw';

type HealthData = {
  service: string;
  status: string;
  timestamp: string;
};

export default function ChatsScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [apiStatus, setApiStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [apiMessage, setApiMessage] = React.useState('未请求');

  const loadHealth = React.useCallback(async () => {
    setApiStatus('loading');
    try {
      const result = await fetchJson<HealthData>('/api/health');
      setApiStatus('ready');
      setApiMessage(`${result.data.status} · ${result.data.service}`);
    } catch (error) {
      setApiStatus('error');
      setApiMessage(error instanceof Error ? error.message : '请求失败');
    }
  }, []);

  React.useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f6f2' }}>
        <ScrollView
          className="flex-1 bg-ink-50"
          contentContainerClassName="px-4 pt-5"
          contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}>
          <Text className="font-rounded text-3xl font-semibold text-ink-900">微信</Text>
          <View className="mt-3 rounded-2xl bg-ink-100 px-4 py-3">
            <Text className="text-sm text-ink-400">搜索</Text>
          </View>

          <Section title="脚手架状态">
            <View className="px-4 py-4">
              <Text className="text-base font-medium text-ink-900">API Route /api/health</Text>
              <Text className="mt-2 text-sm text-ink-400">
                {apiStatus === 'loading' ? '加载中...' : apiMessage}
              </Text>
              <Text className="mt-2 text-xs text-ink-400">
                应用名：{appConfig.appName}
                {appConfig.apiBaseUrl ? ` · API Base：${appConfig.apiBaseUrl}` : ' · API Base：relative'}
              </Text>
              <Pressable className="mt-4 rounded-2xl bg-brand-500 px-4 py-3" onPress={loadHealth}>
                <Text className="text-center text-sm font-medium text-white">重新请求</Text>
              </Pressable>
            </View>
          </Section>

          <Section title="最近会话">
            {chatThreads.map((item) => (
              <ListRow
                key={item.slug}
                badgeCount={item.unread}
                meta={item.meta}
                onPress={() => router.push(`/entry/${item.slug}` as any)}
                subtitle={item.subtitle}
                title={item.title}
              />
            ))}
          </Section>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
