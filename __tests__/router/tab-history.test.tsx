import React from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import * as RootLayoutRoute from '@/app/_layout';
import TabsLayout from '@/app/(tabs)/_layout';

function WechatScreen() {
  return <Text>微信页</Text>;
}

function DiscoverScreen() {
  const router = useRouter();

  return (
    <>
      <Text>发现页</Text>
      <Pressable onPress={() => router.push('/entry/moments' as any)}>
        <Text>进入朋友圈</Text>
      </Pressable>
    </>
  );
}

function EntryScreen() {
  const router = useRouter();

  return (
    <>
      <Text>详情页</Text>
      <Pressable onPress={() => router.back()}>
        <Text>返回上一页</Text>
      </Pressable>
    </>
  );
}

describe('tab history integration', () => {
  it('returns to the previously visited tab after leaving an entry screen', () => {
    const result = renderRouter({
      _layout: RootLayoutRoute,
      '(tabs)/_layout': { default: TabsLayout },
      '(tabs)/index': { default: WechatScreen },
      '(tabs)/contacts': { default: () => <Text>通讯录页</Text> },
      '(tabs)/discover': { default: DiscoverScreen },
      '(tabs)/me': { default: () => <Text>我页</Text> },
      'entry/[slug]': { default: EntryScreen },
      '+not-found': { default: () => <Text>404 占位</Text> },
    });

    expect(result.getPathname()).toBe('/');
    expect(screen.getByText('微信页')).toBeTruthy();

    testRouter.navigate('/discover');

    expect(result.getPathname()).toBe('/discover');
    expect(screen.getByText('发现页')).toBeTruthy();

    testRouter.push('/entry/moments');

    expect(result.getPathname()).toBe('/entry/moments');
    expect(screen.getByText('详情页')).toBeTruthy();

    testRouter.back('/discover');

    expect(screen.getByText('发现页')).toBeTruthy();
  });
});
