import React from 'react';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppProviders } from '@/providers/app-providers';

function QueryConsumer() {
  const { data = 'loading' } = useQuery({
    queryKey: ['provider-test'],
    queryFn: async () => 'ready',
  });

  return <Text testID="query-state">{data}</Text>;
}

describe('AppProviders', () => {
  it('provides a query client', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          retry: false,
        },
      },
    });

    render(
      <AppProviders queryClient={queryClient}>
        <QueryConsumer />
      </AppProviders>
    );

    await waitFor(() => {
      expect(screen.getByText('ready')).toBeTruthy();
    });
  });
});
