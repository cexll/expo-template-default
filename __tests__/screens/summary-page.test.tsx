import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SummaryPage from '@/app/summary/[profileId]';
import { useAuth } from '@/providers/auth-provider';

const mockUseProfile = jest.fn();
const mockUseLesions = jest.fn();
const mockUseActiveReminders = jest.fn();
const mockUseSubscriptionStatus = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/hooks/useProfiles', () => ({
  useProfile: (...args: any[]) => mockUseProfile(...args),
}));

jest.mock('@/hooks/useLesions', () => ({
  useLesions: (...args: any[]) => mockUseLesions(...args),
}));

jest.mock('@/hooks/useReminders', () => ({
  useActiveReminders: (...args: any[]) => mockUseActiveReminders(...args),
}));

jest.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockUseSubscriptionStatus(),
  canUseFeature: () => true,
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const mockUseQueries = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueries: (...args: any[]) => mockUseQueries(...args),
  };
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

describe('SummaryPage UI contract basics', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', phone: '13800000000' },
      signOut: jest.fn(),
    } as any);
  });

  it('rejects an invalid profile id', () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    mockUseProfile.mockReturnValue({ data: undefined, isLoading: false, isFetching: false });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });
    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });
    mockUseQueries.mockReturnValue([]);

    renderWithQueryClient(<SummaryPage />);

    expect(screen.getByLabelText('返回上一层')).toBeTruthy();
    expect(screen.getByText('档案 ID 无效')).toBeTruthy();
  });

  it('shows a not-found state for missing profiles', () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'missing' });

    mockUseProfile.mockReturnValue({ data: null, isLoading: false, isFetching: false });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseActiveReminders.mockReturnValue({ data: [] });
    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });
    mockUseQueries.mockReturnValue([]);

    renderWithQueryClient(<SummaryPage />);

    expect(screen.getByText('未找到该档案')).toBeTruthy();
  });

  it('renders compare-style lesion blocks with deltas, qualitative chains, and follow-up when available', () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: false, featureRemaining: { summary_export: 2 } }, isLoading: false });

    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '张女士', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
      isLoading: false,
      isFetching: false,
    });

    mockUseLesions.mockReturnValue({
      data: [
        { id: 'l1', profile_id: 'profile-1', disease_type: 'thyroid', label: '左叶中下段结节', location: '左叶', is_archived: 0 } as any,
      ],
    });

    mockUseActiveReminders.mockReturnValue({
      data: [{ id: 'r1', lesion_id: 'l1', next_exam_date: '2026-05-01', source: 'auto', is_active: 1 } as any],
    });

    mockUseQueries.mockReturnValue([
      {
        data: [
          { id: 'e3', lesion_id: 'l1', exam_date: '2026-04-01', size_x: 8.3, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '点状强回声', echo_type: '低回声', border: '模糊', density: null, morphology: null, pleural_pull: null } as any,
          { id: 'e2', lesion_id: 'l1', exam_date: '2026-02-01', size_x: 7.8, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '无', echo_type: '低回声', border: '清晰', density: null, morphology: null, pleural_pull: null } as any,
          { id: 'e1', lesion_id: 'l1', exam_date: '2025-12-01', size_x: 7.1, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '无', echo_type: '低回声', border: '清晰', density: null, morphology: null, pleural_pull: null } as any,
        ],
      },
    ]);

    renderWithQueryClient(<SummaryPage />);

    expect(screen.getByText('甲状腺')).toBeTruthy();
    expect(screen.getByText('左叶中下段结节')).toBeTruthy();

    expect(screen.getByText('较上次')).toBeTruthy();
    expect(screen.getByText('较基线')).toBeTruthy();

    expect(screen.getByText('TI-RADS')).toBeTruthy();
    expect(screen.getByText('钙化')).toBeTruthy();

    expect(screen.getByText('建议复查')).toBeTruthy();
    expect(screen.getByText(/2026-05-01/)).toBeTruthy();
  });

  it('degrades single-record lesions to raw-value mode without change rows', () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });
    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
      isLoading: false,
      isFetching: false,
    });

    mockUseLesions.mockReturnValue({
      data: [{ id: 'l1', profile_id: 'profile-1', disease_type: 'thyroid', label: '结节', location: '左叶', is_archived: 0 } as any],
    });

    mockUseActiveReminders.mockReturnValue({ data: [] });
    mockUseQueries.mockReturnValue([
      {
        data: [
          { id: 'e1', lesion_id: 'l1', exam_date: '2026-04-01', size_x: 8.3, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '无', echo_type: null, border: null, density: null, morphology: null, pleural_pull: null } as any,
        ],
      },
    ]);

    renderWithQueryClient(<SummaryPage />);

    expect(screen.queryByText('较上次')).toBeNull();
    expect(screen.queryByText('较基线')).toBeNull();
  });

  it('uses the earliest exam for baseline deltas and renders every changed qualitative row when 4+ exams exist', () => {
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({ profileId: 'profile-1' });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });
    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
      isLoading: false,
      isFetching: false,
    });

    mockUseLesions.mockReturnValue({
      data: [
        { id: 'l1', profile_id: 'profile-1', disease_type: 'thyroid', label: '结节', location: '左叶', is_archived: 0 } as any,
      ],
    });

    mockUseActiveReminders.mockReturnValue({ data: [] });
    mockUseQueries.mockReturnValue([
      {
        data: [
          { id: 'e4', lesion_id: 'l1', exam_date: '2026-04-01', size_x: 8.0, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '点状强回声', echo_type: '低回声', border: '模糊', density: null, morphology: null, pleural_pull: null } as any,
          { id: 'e3', lesion_id: 'l1', exam_date: '2026-03-01', size_x: 7.8, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '无', echo_type: '等回声', border: '清晰', density: null, morphology: null, pleural_pull: null } as any,
          { id: 'e2', lesion_id: 'l1', exam_date: '2026-02-01', size_x: 7.5, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '无', echo_type: '等回声', border: '清晰', density: null, morphology: null, pleural_pull: null } as any,
          { id: 'e1', lesion_id: 'l1', exam_date: '2025-12-01', size_x: 6.0, size_y: null, size_z: null, tirads: '3', birads: null, lung_rads: null, calcification: '无', echo_type: '高回声', border: '规整', density: null, morphology: null, pleural_pull: null } as any,
        ],
      },
    ]);

    renderWithQueryClient(<SummaryPage />);

    expect(screen.getByText('▲ +2.0mm (+33%)')).toBeTruthy();
    expect(screen.getByText('钙化')).toBeTruthy();
    expect(screen.getByText('回声')).toBeTruthy();
    expect(screen.getByText('边界')).toBeTruthy();
  });
});
