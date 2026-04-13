import React from 'react';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Section } from '@/components/wechat-ui';
import { meEntries } from '@/data/wechat';
import { trackEvent } from '@/lib/telemetry/client';
import { useAuth } from '@/providers/auth-provider';
import { ScrollView, Pressable, Text, View } from '@/tw';

export default function MeScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { signInDemo, signOut, user } = useAuth();

  const handleSignIn = async () => {
    signInDemo();
    await trackEvent({ event: 'auth_sign_in_demo' });
  };

  const handleSignOut = async () => {
    signOut();
    await trackEvent({ event: 'auth_sign_out_demo' });
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f6f2' }}>
        <ScrollView
          className="flex-1 bg-ink-50"
          contentContainerClassName="px-4 pt-5"
          contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}>
          <Pressable onPress={() => router.push('/entry/settings' as any)}>
            <View className="rounded-[32px] bg-white px-5 py-5">
              <View className="flex-row items-center gap-4">
                <View className="h-16 w-16 items-center justify-center rounded-[24px] bg-brand-100">
                  <Text className="text-2xl font-semibold text-brand-700">CW</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-rounded text-2xl font-semibold text-ink-900">Chen Wenjie</Text>
                  <Text className="mt-1 text-sm text-ink-400">微信号：chenwenjie</Text>
                </View>
              </View>
            </View>
          </Pressable>

          <Section title="认证占位">
            <View className="px-4 py-4">
              <Text className="text-base font-medium text-ink-900">
                {user ? `当前会话：${user.name}` : '当前未登录'}
              </Text>
              <Text className="mt-2 text-sm leading-6 text-ink-400">
                这是脚手架层的认证占位。后续可以替换成 Clerk、Auth0、Supabase Auth 或自建会话系统。
              </Text>
              <View className="mt-4 flex-row gap-3">
                <Pressable className="flex-1 rounded-2xl bg-brand-500 px-4 py-3" onPress={handleSignIn}>
                  <Text className="text-center text-sm font-medium text-white">Demo 登录</Text>
                </Pressable>
                <Pressable className="flex-1 rounded-2xl bg-ink-100 px-4 py-3" onPress={handleSignOut}>
                  <Text className="text-center text-sm font-medium text-ink-700">退出</Text>
                </Pressable>
              </View>
            </View>
          </Section>

          <Section title="监控 / 埋点接口">
            <View className="px-4 py-4">
              <Text className="text-base font-medium text-ink-900">POST /api/telemetry</Text>
              <Text className="mt-2 text-sm leading-6 text-ink-400">
                当前 Demo 登录/退出会触发埋点接口。这里先固定协议和服务端入口，不强绑第三方监控厂商。
              </Text>
            </View>
          </Section>

          <Section title="我的服务">
            {meEntries.map((item) => (
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
