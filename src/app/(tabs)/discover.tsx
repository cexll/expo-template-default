import React from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Section } from '@/components/wechat-ui';
import { discoverEntries } from '@/data/wechat';
import { ScrollView, Text } from '@/tw';

export default function DiscoverScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f6f2' }}>
        <ScrollView
          className="flex-1 bg-ink-50"
          contentContainerClassName="px-4 pt-5"
          contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}>
          <Text className="font-rounded text-3xl font-semibold text-ink-900">发现</Text>

          <Section title="服务入口">
            {discoverEntries.map((item) => (
              <ListRow
                key={item.slug}
                leading={item.leading}
                onPress={() => router.push(`/entry/${item.slug}` as any)}
                showDot={item.showDot}
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
