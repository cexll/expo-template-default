import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { entryBySlug } from '@/data/wechat';
import { Pressable, Text, View } from '@/tw';

export default function EntryDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const entry = slug ? entryBySlug[String(slug)] : undefined;

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f6f2' }}>
        <View className="flex-1 bg-ink-50 px-4 pt-5">
          <Pressable onPress={() => router.back()}>
            <Text className="text-sm font-medium text-brand-500">返回</Text>
          </Pressable>

          <View className="mt-4 rounded-[32px] bg-white px-6 py-8">
            <Text className="text-xs uppercase tracking-[2px] text-ink-400">
              {entry?.category ?? '未定义'}
            </Text>
            <Text className="mt-3 font-rounded text-4xl font-semibold text-ink-900">
              {entry?.title ?? '未找到页面'}
            </Text>
            <Text className="mt-3 text-base leading-7 text-ink-400">
              {entry?.description ?? '这个占位页还没有绑定到具体入口。'}
            </Text>
          </View>

          <View className="mt-6 rounded-[32px] bg-brand-700 px-6 py-8">
            <Text className="font-rounded text-2xl font-semibold text-white">基础交互占位</Text>
            <Text className="mt-3 text-base leading-7 text-brand-100">
              当前点击已经能进入二级页。后续如果你要，我可以继续把聊天详情、设置列表、朋友圈流拆成真实页面。
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
