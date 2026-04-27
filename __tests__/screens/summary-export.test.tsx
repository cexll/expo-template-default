import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SummaryPage from '@/app/summary/[profileId]';
import { useAuth } from '@/providers/auth-provider';

const mockUseSubscriptionStatus = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
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

jest.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockUseSubscriptionStatus(),
  canUseFeature: (status: any, feature: 'ai_recognize' | 'summary_export') => {
    if (!status) return true;
    if (status.isActive) return true;
    const remaining = status.featureRemaining?.[feature];
    if (typeof remaining === 'number') return remaining > 0;
    return true;
  },
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

describe('SummaryPage export', () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', phone: '13800000000' },
      signOut: jest.fn(),
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  }

  it('exports a real generated image through native share edge', async () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
    });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });

    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    renderWithQueryClient(<SummaryPage />);

    fireEvent.press(screen.getByText('保存为图片'));

    await waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockShareAsync).toHaveBeenCalledWith('file:///tmp/summary.png', expect.any(Object));
  });

  it('blocks export when quota is exhausted', async () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    mockUseSubscriptionStatus.mockReturnValue({
      data: { isActive: false, featureRemaining: { summary_export: 0 } },
      isLoading: false,
    });

    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
    });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });

    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);

    renderWithQueryClient(<SummaryPage />);

    fireEvent.press(screen.getByText('保存为图片'));

    await waitFor(() => {
      expect(screen.getByText('升级解锁')).toBeTruthy();
    });

    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
  });
});
