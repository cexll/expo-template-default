import React from 'react';
import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import * as RootLayoutRoute from '@/app/_layout';
import TabsLayout from '@/app/(tabs)/_layout';
import { useAuth } from '@/providers/auth-provider';

function ProviderProbeScreen() {
  const { user, signInDemo } = useAuth();
  const { data = 'loading' } = useQuery({
    queryKey: ['router-provider-probe'],
    queryFn: async () => 'query-ready',
  });

  React.useEffect(() => {
    signInDemo();
  }, [signInDemo]);

  return (
    <>
      <Text>{user ? user.name : 'anonymous'}</Text>
      <Text>{data}</Text>
      <Text>首页探针</Text>
    </>
  );
}

describe('root router integration', () => {
  it('mounts providers and renders the index tab screen', async () => {
    renderRouter({
      _layout: RootLayoutRoute,
      '(tabs)/_layout': { default: TabsLayout },
      '(tabs)/index': { default: ProviderProbeScreen },
      '(tabs)/contacts': { default: () => <Text>通讯录占位</Text> },
      '(tabs)/discover': { default: () => <Text>发现占位</Text> },
      '(tabs)/me': { default: () => <Text>我占位</Text> },
      'entry/[slug]': { default: () => <Text>详情占位</Text> },
      '+not-found': { default: () => <Text>404 占位</Text> },
    });

    expect(screen.getByText('微信')).toBeTruthy();
    expect(screen.getByText('通讯录')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Chen Wenjie')).toBeTruthy();
      expect(screen.getByText('query-ready')).toBeTruthy();
      expect(screen.getByText('首页探针')).toBeTruthy();
    });
  });
});
