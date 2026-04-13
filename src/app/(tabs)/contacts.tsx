import React from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Section } from '@/components/wechat-ui';
import { contactEntrances, contacts } from '@/data/wechat';
import { ScrollView, Text, View } from '@/tw';

export default function ContactsScreen() {
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
          <Text className="font-rounded text-3xl font-semibold text-ink-900">通讯录</Text>
          <View className="mt-3 rounded-2xl bg-ink-100 px-4 py-3">
            <Text className="text-sm text-ink-400">搜索联系人</Text>
          </View>

          <Section title="常用入口">
            {contactEntrances.map((item) => (
              <ListRow
                key={item.slug}
                leading={item.leading}
                onPress={() => router.push(`/entry/${item.slug}` as any)}
                subtitle={item.subtitle}
                title={item.title}
              />
            ))}
          </Section>

          <Section title="联系人">
            {contacts.map((item) => (
              <ListRow
                key={item.slug}
                leading={item.leading}
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
