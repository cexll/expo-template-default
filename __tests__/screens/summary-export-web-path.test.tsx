import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SummaryPage from '@/app/summary/[profileId]';

const mockUseSubscriptionStatus = jest.fn();
const mockExportSummaryImage = jest.fn();
const mockRenderSummaryExportImage = jest.fn();
const mockCapture = jest.fn(async () => 'file:///tmp/summary.png');

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock('react-native-view-shot', () => {
  const React = require('react');

  const ViewShot = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ capture: mockCapture }));
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
  canUseFeature: () => true,
  subscriptionKeys: {
    status: (accountKey?: string | null) => ['subscription', 'status', accountKey ?? 'anonymous'],
  },
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', phone: '13800000000' },
    signOut: jest.fn(),
  }),
}));

jest.mock('@/lib/summary/export-image', () => ({
  exportSummaryImage: (...args: any[]) => mockExportSummaryImage(...args),
}));

jest.mock('@/lib/summary/render-export-image', () => ({
  renderSummaryExportImage: (...args: any[]) => mockRenderSummaryExportImage(...args),
}));

describe('SummaryPage web export path', () => {
  const originalPlatformOsValue = Platform.OS;

  beforeEach(() => {
    mockRenderSummaryExportImage.mockReturnValue('data:image/png;base64,Zm9v');
    mockExportSummaryImage.mockResolvedValue(undefined);

    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    mockUseSubscriptionStatus.mockReturnValue({
      data: { isActive: false, featureRemaining: { summary_export: 2 } },
      isLoading: false,
    });
    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
      isLoading: false,
      isFetching: false,
    });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });

    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatformOsValue;
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

  it('uses the dedicated web renderer instead of view-shot capture', async () => {
    renderWithQueryClient(<SummaryPage />);

    fireEvent.press(screen.getByText('导出为图片'));

    await waitFor(() => {
      expect(mockRenderSummaryExportImage).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          nickname: '本人',
          lesionCount: 0,
        })
      );
    });

    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockExportSummaryImage).toHaveBeenCalledWith({
      uri: 'data:image/png;base64,Zm9v',
      nickname: '本人',
    });
  });
});
