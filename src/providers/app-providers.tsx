import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { AuthProvider } from '@/providers/auth-provider';
import { ActiveProfileProvider } from '@/providers/active-profile-provider';

type Props = {
  children: React.ReactNode;
  queryClient?: QueryClient;
};

export function AppProviders({ children, queryClient: externalQueryClient }: Props) {
  const [queryClient] = React.useState(
    () =>
      externalQueryClient ??
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ActiveProfileProvider>{children}</ActiveProfileProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
