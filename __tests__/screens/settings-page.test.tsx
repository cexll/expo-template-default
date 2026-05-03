import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SettingsPage from '@/app/(main)/settings';
import { api } from '@/lib/api';
import { listProfiles } from '@/lib/db/queries/profiles';
import { readLocalArchiveSettingsSnapshot } from '@/lib/settings/archive-snapshot';
import { syncCloudArchiveIfEntitled } from '@/lib/cloud-sync';
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

jest.mock('@/lib/settings/archive-snapshot', () => {
  const actual = jest.requireActual('@/lib/settings/archive-snapshot');
  return {
    ...actual,
    readLocalArchiveSettingsSnapshot: jest.fn(),
  };
});

jest.mock('@/lib/cloud-sync', () => ({
  syncCloudArchiveIfEntitled: jest.fn(),
}));

const apiGetMock = jest.mocked(api.get);
const useAuthMock = jest.mocked(useAuth);
const listProfilesMock = jest.mocked(listProfiles);
const readSnapshotMock = jest.mocked(readLocalArchiveSettingsSnapshot);
const syncCloudArchiveIfEntitledMock = jest.mocked(syncCloudArchiveIfEntitled);

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
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', phone: '13800000000', nickname: '阿明' },
      signOut: jest.fn(),
    } as any);
    readSnapshotMock.mockResolvedValue({
      profileCount: 2,
      lesionCount: 3,
      examinationCount: 5,
      reportImageCount: 4,
      activeReminderCount: 1,
    });
  });

  it('renders sectioned rows from real profile, archive snapshot, auth, and subscription state', async () => {
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
      expect(screen.getByText('阿明、小王 · 共2人')).toBeTruthy();
      expect(screen.getByText('本地档案 2人 · 3病灶 · 5检查 · 4张图片')).toBeTruthy();
      expect(screen.getByText('短信 138****0000')).toBeTruthy();
      expect(screen.getByText('年度会员 · 有效期至 2026-12-31')).toBeTruthy();
    });
  });

  it('shows free-plan quota remaining for both AI and summary export', async () => {
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

  it('reads paid cloud sync entitlement from subscription state before syncing', async () => {
    listProfilesMock.mockResolvedValue([{ id: 'p1', nickname: '本人' } as any]);
    apiGetMock.mockResolvedValue({
      plan: 'yearly',
      is_active: true,
      expires_at: null,
      cloud_sync_enabled: true,
    });
    syncCloudArchiveIfEntitledMock.mockResolvedValue({ skipped: false, syncedCount: 5 });

    renderWithQueryClient(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('会员已开启 · 2个档案可同步')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('云端同步'));

    await waitFor(() => {
      expect(syncCloudArchiveIfEntitledMock).toHaveBeenCalledWith(expect.objectContaining({ isCloudSyncEnabled: true }));
      expect(screen.getByText('云端同步完成 · 5项')).toBeTruthy();
    });
  });

  it('shows account and notification affordances without fixed prototype copy', async () => {
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

    expect(screen.getByText('138****0000')).toBeTruthy();
    expect(screen.getByText('系统通知随设备权限管理')).toBeTruthy();
    expect(screen.getByText('提醒联系方式')).toBeTruthy();
    expect(screen.getByText('升级')).toBeTruthy();
    expect(screen.getByText('结节档案 v1.0.0 · 数据仅供参考，不构成诊断')).toBeTruthy();
  });
});
