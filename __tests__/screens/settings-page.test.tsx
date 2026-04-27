import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SettingsPage from '@/app/(main)/settings';
import { api } from '@/lib/api';
import { listProfiles } from '@/lib/db/queries/profiles';
import { useAuth } from '@/providers/auth-provider';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockPush,
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
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

  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it('renders UI-005 prototype settings state without stored profile/session data', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      signOut: jest.fn(),
    } as any);
    listProfilesMock.mockResolvedValue([]);
    apiGetMock.mockResolvedValue({ plan: 'free', is_active: false, expires_at: null } as any);

    mockUseLocalSearchParams.mockReturnValue({ prototypeUi005Seed: 'demo' });

    renderWithQueryClient(<SettingsPage />);

    expect(screen.getByText('本人、妈妈 · 共2人')).toBeTruthy();
    expect(screen.getByText('免费版 · AI识别剩余0次 · 摘要导出剩余0次')).toBeTruthy();
    expect(screen.getByText('升级')).toBeTruthy();
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

  it('shows free-plan quota remaining for both AI and summary export', async () => {
    useAuthMock.mockReturnValue({
      user: { phone: '13800000000' },
      signOut: jest.fn(),
    } as any);

    listProfilesMock.mockResolvedValue([{ id: 'p1', nickname: '阿明' } as any]);

    apiGetMock.mockResolvedValue({
      plan: 'free',
      is_active: false,
      ai_recognize_remaining: 3,
      summary_export_remaining: 1,
      expires_at: null,
    } as any);

    renderWithQueryClient(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('免费版 · AI识别剩余3次 · 摘要导出剩余1次')).toBeTruthy();
    });
  });

  it('matches the demo settings account, storage, notification, and subscription affordances', async () => {
    useAuthMock.mockReturnValue({
      user: { phone: '13888888888' },
      signOut: jest.fn(),
    } as any);

    listProfilesMock.mockResolvedValue([
      { id: 'p1', nickname: '本人' } as any,
      { id: 'p2', nickname: '妈妈' } as any,
      { id: 'p3', nickname: '爸爸' } as any,
    ]);

    apiGetMock.mockResolvedValue({
      plan: 'free',
      is_active: false,
      ai_recognize_remaining: 3,
      expires_at: null,
    } as any);

    renderWithQueryClient(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('本人、妈妈、爸爸 · 共3人')).toBeTruthy();
    });

    expect(screen.getByText('138****8888')).toBeTruthy();
    expect(screen.getByText('已用 12MB')).toBeTruthy();
    expect(screen.getByText('浏览器通知')).toBeTruthy();
    expect(screen.getByText('zhang@example.com')).toBeTruthy();
    expect(screen.getByText('升级')).toBeTruthy();
    expect(screen.getByText('结节档案 v1.0.0 · 数据仅供参考，不构成诊断')).toBeTruthy();
  });
});

