import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SubscriptionPage from '@/app/subscription';
import SubscriptionSuccessPage from '@/app/subscription/success';
import SettingsPage from '@/app/(main)/settings';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
  },
  AuthError: class AuthError extends Error {},
  ApiError: class ApiError extends Error {
    code: number;
    status: number;
    constructor(message: string, code: number, status: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
    }
  },
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const apiMock = api as unknown as {
  get: jest.Mock;
  post: jest.Mock;
};

const useAuthMock = useAuth as unknown as jest.Mock;

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

describe('subscription order flow', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('submits the selected plan/provider and navigates with order context', async () => {
    const expoRouter = require('expo-router') as {
      router: { push: jest.Mock };
    };

    apiMock.post.mockResolvedValue({ order_id: 'ord_1' });

    render(<SubscriptionPage />);

    fireEvent.press(screen.getByText('月付'));
    fireEvent.press(screen.getByText('支付宝'));
    fireEvent.press(screen.getByText('立即订阅'));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/api/v1/subscription/order', {
        plan: 'monthly',
        provider: 'alipay',
      });
    });

    expect(expoRouter.router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/subscription/success',
        params: expect.objectContaining({
          order_id: 'ord_1',
          plan: 'monthly',
          provider: 'alipay',
        }),
      })
    );
  });

  it('renders a truthful pending state on the success page (no hard-coded active subscription)', async () => {
    const expoRouter = require('expo-router') as {
      useLocalSearchParams: jest.Mock;
    };

    expoRouter.useLocalSearchParams.mockReturnValue({
      order_id: 'ord_1',
      plan: 'yearly',
      provider: 'wechat',
    });
    apiMock.get.mockResolvedValue({ plan: 'free', is_active: false, expires_at: null });

    renderWithQueryClient(<SubscriptionSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('订单已创建')).toBeTruthy();
      expect(screen.getByText('ord_1')).toBeTruthy();
      expect(screen.getByText('年度会员')).toBeTruthy();
      expect(screen.getByText('微信支付')).toBeTruthy();
      expect(screen.getByText('支付完成后更新')).toBeTruthy();
    });
  });

  it('reads the current plan from subscription state on settings', async () => {
    useAuthMock.mockReturnValue({
      user: { phone: '13800000000' },
      signOut: jest.fn(),
    });
    apiMock.get.mockResolvedValue({ plan: 'yearly', is_active: true, expires_at: null });

    renderWithQueryClient(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/年度会员/)).toBeTruthy();
    });
  });
});
