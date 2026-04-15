import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SummaryPage from '@/app/summary/[profileId]';
import { subscriptionKeys } from '@/hooks/useSubscriptionStatus';
import { api } from '@/lib/api';
import { formatLocalMonth, readLocalSummaryExportUsed, writeLocalSummaryExportUsed } from '@/lib/subscription/local-quota';
import { useAuth } from '@/providers/auth-provider';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}));

const mockShareAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();

jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args: any[]) => mockShareAsync(...args),
}));

jest.mock('react-native-view-shot', () => {
  const React = require('react');
  const capture = jest.fn(async () => 'file:///tmp/summary.png');

  const ViewShot = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ capture }));
    return React.createElement(React.Fragment, null, props.children);
  });
  ViewShot.displayName = 'ViewShotMock';

  return {
    __esModule: true,
    default: ViewShot,
  };
});

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

const mockUseProfile = jest.fn();
const mockUseLesions = jest.fn();
const mockUseActiveReminders = jest.fn();

jest.mock('@/hooks/useProfiles', () => ({
  useProfile: (...args: any[]) => mockUseProfile(...args),
}));

jest.mock('@/hooks/useLesions', () => ({
  useLesions: (...args: any[]) => mockUseLesions(...args),
}));

jest.mock('@/hooks/useReminders', () => ({
  useActiveReminders: (...args: any[]) => mockUseActiveReminders(...args),
}));

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueries: () => [],
  };
});

const apiGetMock = jest.mocked(api.get);
const useAuthMock = jest.mocked(useAuth);

describe('SummaryPage export quota consumption', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    // @ts-expect-error test shim
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error test shim
    globalThis.localStorage = originalLocalStorage;
  });

  function renderWithQueryClient(node: React.ReactElement) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          gcTime: Infinity,
          retry: false,
        },
      },
    });

    return { queryClient, ...render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>) };
  }

  it('decrements remaining exports after success and blocks after the monthly free cap', async () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    useAuthMock.mockReturnValue({
      user: { id: 'user-a', phone: '13800000000' },
      signOut: jest.fn(),
    } as any);

    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 } as any,
      isLoading: false,
      isFetching: false,
    });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });

    apiGetMock.mockResolvedValue({
      plan: 'free',
      is_active: false,
      summary_export_remaining: 2,
      ai_recognize_remaining: 5,
      expires_at: null,
    } as any);

    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    const { queryClient } = renderWithQueryClient(<SummaryPage />);

    await waitFor(() => {
      expect(queryClient.getQueryData(subscriptionKeys.status('user-a'))).toBeTruthy();
    });

    fireEvent.press(screen.getByText('导出为图片'));
    await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readLocalSummaryExportUsed(formatLocalMonth(), 'user-a')).toBe(1));

    fireEvent.press(screen.getByText('导出为图片'));
    await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readLocalSummaryExportUsed(formatLocalMonth(), 'user-a')).toBe(2));

    fireEvent.press(screen.getByText('导出为图片'));
    await waitFor(() => {
      expect(screen.getByText('升级解锁')).toBeTruthy();
    });
    expect(mockShareAsync).toHaveBeenCalledTimes(2);
  });

  it('restores export access after premium activation even when local free-tier usage is already exhausted', async () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    useAuthMock.mockReturnValue({
      user: { id: 'user-a', phone: '13800000000' },
      signOut: jest.fn(),
    } as any);

    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 } as any,
      isLoading: false,
      isFetching: false,
    });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });

    apiGetMock.mockResolvedValue({
      plan: 'yearly',
      is_premium: true,
      summary_export_used: 2,
      summary_export_limit: -1,
      ai_recognize_used: 5,
      ai_recognize_limit: -1,
      expires_at: '2026-12-31T00:00:00.000Z',
    } as any);

    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    writeLocalSummaryExportUsed(formatLocalMonth(), 2, 'user-a');

    const { queryClient } = renderWithQueryClient(<SummaryPage />);

    await waitFor(() => {
      expect(queryClient.getQueryData(subscriptionKeys.status('user-a'))).toBeTruthy();
    });

    fireEvent.press(screen.getByText('导出为图片'));

    await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('升级解锁')).toBeNull();
  });

  it('keeps summary export quota isolated between different signed-in users in the same browser', async () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 } as any,
      isLoading: false,
      isFetching: false,
    });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });

    apiGetMock.mockResolvedValue({
      plan: 'free',
      is_active: false,
      summary_export_remaining: 2,
      ai_recognize_remaining: 5,
      expires_at: null,
    } as any);

    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    useAuthMock.mockReturnValue({
      user: { id: 'user-a', phone: '13800000000' },
      signOut: jest.fn(),
    } as any);

    const firstRender = renderWithQueryClient(<SummaryPage />);

    await waitFor(() => {
      expect(firstRender.queryByText('导出为图片')).toBeTruthy();
      expect(firstRender.queryClient.getQueryData(subscriptionKeys.status('user-a'))).toBeTruthy();
    });

    fireEvent.press(screen.getByText('导出为图片'));
    await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(1));
    fireEvent.press(screen.getByText('导出为图片'));
    await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(readLocalSummaryExportUsed(formatLocalMonth(), 'user-a')).toBe(2));

    firstRender.unmount();

    useAuthMock.mockReturnValue({
      user: { id: 'user-b', phone: '13900000000' },
      signOut: jest.fn(),
    } as any);

    const secondRender = renderWithQueryClient(<SummaryPage />);

    await waitFor(() => {
      expect(secondRender.queryClient.getQueryData(subscriptionKeys.status('user-b'))).toBeTruthy();
    });

    fireEvent.press(screen.getByText('导出为图片'));
    await waitFor(() => expect(mockShareAsync).toHaveBeenCalledTimes(3));

    expect(readLocalSummaryExportUsed(formatLocalMonth(), 'user-a')).toBe(2);
    expect(readLocalSummaryExportUsed(formatLocalMonth(), 'user-b')).toBe(1);
    expect(screen.queryByText('升级解锁')).toBeNull();
  });
});
