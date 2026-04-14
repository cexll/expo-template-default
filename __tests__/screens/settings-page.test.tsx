import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SettingsPage from '@/app/(main)/settings';
import { api } from '@/lib/api';
import { listProfiles } from '@/lib/db/queries/profiles';
import { useAuth } from '@/providers/auth-provider';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockPush,
    replace: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
  },
  AuthError: class AuthError extends Error {},
  ApiError: class ApiError extends Error {},
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/db/queries/profiles', () => ({
  listProfiles: jest.fn(),
}));

const apiGetMock = jest.mocked(api.get);
const useAuthMock = jest.mocked(useAuth);
const listProfilesMock = jest.mocked(listProfiles);

function renderWithQueryClient(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe('SettingsPage UI parity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders sectioned rows and shows a real subscription summary', async () => {
    useAuthMock.mockReturnValue({
      user: { phone: '13800000000' },
      signOut: jest.fn(),
    } as any);

    listProfilesMock.mockResolvedValue([
      { id: 'p1', nickname: '阿明' } as any,
      { id: 'p2', nickname: '小王' } as any,
    ]);

    apiGetMock.mockResolvedValue({
      plan: 'yearly',
      is_active: true,
      expires_at: '2026-12-31T00:00:00.000Z',
    } as any);

    renderWithQueryClient(<SettingsPage />);

    expect(screen.getByText('账号')).toBeTruthy();
    expect(screen.getByText('存储')).toBeTruthy();
    expect(screen.getByText('通知')).toBeTruthy();
    expect(screen.getByText('订阅')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('年度会员 · 有效期至 2026-12-31')).toBeTruthy();
    });
  });
});

