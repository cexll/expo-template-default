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

    apiMock.post.mockResolvedValue({ order_id: 'ord_1', amount: 39.9, currency: 'CNY' });

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
          amount: '39.9',
          currency: 'CNY',
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
      expect(screen.getByText('待支付平台确认')).toBeTruthy();
      expect(screen.getByText('支付完成后更新')).toBeTruthy();
    });

    expect(screen.queryByText('已解锁会员权益')).toBeNull();
  });

  it('shows unlocked rights only after live premium status turns active', async () => {
    const expoRouter = require('expo-router') as {
      useLocalSearchParams: jest.Mock;
    };

    expoRouter.useLocalSearchParams.mockReturnValue({
      order_id: 'ord_2',
      plan: 'yearly',
      provider: 'wechat',
      amount: '399',
      currency: 'CNY',
    });
    apiMock.get.mockResolvedValue({
      plan: 'yearly',
      is_premium: true,
      expires_at: '2026-12-31T00:00:00.000Z',
    });

    renderWithQueryClient(<SubscriptionSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('订阅已生效')).toBeTruthy();
      expect(screen.getByText('会员权益已可用，AI识别与摘要导出额度限制已解除')).toBeTruthy();
      expect(screen.getByText('¥399.00')).toBeTruthy();
      expect(screen.getByText('2026-12-31T00:00:00.000Z')).toBeTruthy();
      expect(screen.getByText('已解锁会员权益')).toBeTruthy();
      expect(screen.getByText('AI识别次数')).toBeTruthy();
      expect(screen.getByText('云端同步备份')).toBeTruthy();
      expect(screen.getByText('会员支持（开发中）')).toBeTruthy();
    });

    expect(screen.getAllByText('无限次 ✓')).toHaveLength(2);
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
