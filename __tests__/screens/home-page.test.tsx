import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import HomePage from '@/app/(main)/index';
import { api } from '@/lib/api';
import { listProfiles } from '@/lib/db/queries/profiles';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';

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

jest.mock('@/lib/db/queries/profiles', () => ({
  listProfiles: jest.fn(),
}));

jest.mock('@/lib/db/queries/lesions', () => ({
  listLesionsByProfile: jest.fn(),
}));

jest.mock('@/lib/db/queries/reminders', () => ({
  listActiveRemindersByProfile: jest.fn(),
}));

jest.mock('@/lib/db/queries/examinations', () => ({
  listExaminationsByLesion: jest.fn(),
}));

jest.mock('@/providers/active-profile-provider', () => ({
  useActiveProfile: () => ({
    activeProfileId: 'profile_1',
    setActiveProfileId: jest.fn(),
  }),
}));

const listProfilesMock = jest.mocked(listProfiles);
const listLesionsByProfileMock = jest.mocked(listLesionsByProfile);
const listActiveRemindersByProfileMock = jest.mocked(listActiveRemindersByProfile);
const listExaminationsByLesionMock = jest.mocked(listExaminationsByLesion);
const apiGetMock = jest.mocked(api.get);

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

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

describe('HomePage UI parity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    listProfilesMock.mockResolvedValue([
      {
        id: 'profile_1',
        nickname: '阿明',
      } as any,
    ]);

    listLesionsByProfileMock.mockImplementation(async (profileId) => {
      if (profileId !== 'profile_1') return [];
      return [
        {
          id: 'lesion_1',
          profile_id: 'profile_1',
          disease_type: 'thyroid',
          label: '左叶结节',
          location: '左叶',
          is_archived: 0,
        } as any,
      ];
    });

    listActiveRemindersByProfileMock.mockImplementation(async (profileId) => {
      if (profileId !== 'profile_1') return [];
      return [
        {
          id: 'reminder_1',
          lesion_id: 'lesion_1',
          next_exam_date: isoDaysFromNow(7),
          source: 'auto',
          is_active: 1,
        } as any,
      ];
    });

    listExaminationsByLesionMock.mockImplementation(async (lesionId) => {
      if (lesionId !== 'lesion_1') return [];
      return [
        {
          id: 'exam_2',
          lesion_id: 'lesion_1',
          exam_date: isoDaysFromNow(-1),
          size_x: 10,
          size_y: 8,
          size_z: null,
          tirads: '4a',
          birads: null,
          lung_rads: null,
        } as any,
        {
          id: 'exam_1',
          lesion_id: 'lesion_1',
          exam_date: isoDaysFromNow(-60),
          size_x: 8,
          size_y: 8,
          size_z: null,
          tirads: '3',
          birads: null,
          lung_rads: null,
        } as any,
      ];
    });

    apiGetMock.mockResolvedValue({
      plan: 'free',
      is_active: false,
      ai_recognize_remaining: 2,
      expires_at: null,
    } as any);
  });

  it('renders profile strip, urgent alert bar, quota strip, and opens paywall modal on upgrade tap', async () => {
    renderWithQueryClient(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('阿明')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText(/甲状腺复查/)).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('本月 AI 识别剩余 2 次')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('升级'));

    await waitFor(() => {
      expect(screen.getByText('升级解锁')).toBeTruthy();
    });
  });

  it('renders lesion card title/subtitle, metrics, record count, and reminder footer', async () => {
    renderWithQueryClient(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('左叶结节')).toBeTruthy();
    });

    expect(screen.getByText('甲状腺 · 左叶')).toBeTruthy();
    expect(screen.getByText('当前大小')).toBeTruthy();
    expect(screen.getByText('10×8mm')).toBeTruthy();
    expect(screen.getByText('分级')).toBeTruthy();
    expect(screen.getByText('TI-RADS 4a')).toBeTruthy();
    expect(screen.getByText('较基线')).toBeTruthy();
    expect(screen.getByText('▲25%')).toBeTruthy();
    expect(screen.getByText('2次记录')).toBeTruthy();
    expect(screen.getByText(/天后复查/)).toBeTruthy();
  });
});

