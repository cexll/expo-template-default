import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import HomePage from '@/app/(main)/index';
import { api } from '@/lib/api';
import { listProfiles } from '@/lib/db/queries/profiles';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  usePathname: () => '/',
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

jest.mock('@/providers/active-profile-provider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useActiveProfile: () => {
      const [activeProfileId, setActiveProfileId] = React.useState('profile_1');
      return { activeProfileId, setActiveProfileId, bootstrapHomeDefaultProfile: () => {} };
    },
  };
});

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

  it('defaults to the first profile, surfaces urgent inactive-chip copy and alert, and switches profile without stale bleed', async () => {
    listProfilesMock.mockResolvedValue([
      { id: 'profile_1', nickname: '本人' } as any,
      { id: 'profile_2', nickname: '妈妈' } as any,
    ]);

    listLesionsByProfileMock.mockImplementation(async (profileId) => {
      if (profileId === 'profile_1') {
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
      }
      if (profileId === 'profile_2') {
        return [
          {
            id: 'lesion_2',
            profile_id: 'profile_2',
            disease_type: 'breast',
            label: '右乳结节',
            location: '右侧',
            is_archived: 0,
          } as any,
        ];
      }
      return [];
    });

    listActiveRemindersByProfileMock.mockImplementation(async (profileId) => {
      if (profileId === 'profile_2') {
        return [
          {
            id: 'reminder_2',
            lesion_id: 'lesion_2',
            next_exam_date: isoDaysFromNow(3),
            source: 'auto',
            is_active: 1,
          } as any,
        ];
      }
      return [];
    });

    listExaminationsByLesionMock.mockImplementation(async (lesionId) => {
      if (lesionId === 'lesion_1') {
        return [
          {
            id: 'exam_1',
            lesion_id: 'lesion_1',
            exam_date: isoDaysFromNow(-10),
            size_x: 8.3,
            size_y: null,
            size_z: null,
            tirads: '3',
            birads: null,
            lung_rads: null,
          } as any,
        ];
      }
      if (lesionId === 'lesion_2') {
        return [
          {
            id: 'exam_2',
            lesion_id: 'lesion_2',
            exam_date: isoDaysFromNow(-20),
            size_x: 12,
            size_y: null,
            size_z: null,
            tirads: null,
            birads: '3',
            lung_rads: null,
          } as any,
        ];
      }
      return [];
    });

    renderWithQueryClient(<HomePage />);

    // Defaults to profile_1 (first profile) and shows its lesions.
    await waitFor(() => {
      expect(screen.getByText('左叶结节')).toBeTruthy();
    });
    expect(screen.queryByText('右乳结节')).toBeNull();

    // Urgent inactive-chip subtitle for profile_2 and global alert bar pick the soonest reminder.
    await waitFor(() => {
      expect(screen.getByText('3天后!')).toBeTruthy();
      expect(screen.getByText('妈妈的乳腺复查还有 3 天')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('profile-switcher-chip-profile_2'));

    await waitFor(() => {
      expect(screen.getByText('右乳结节')).toBeTruthy();
    });
    expect(screen.queryByText('左叶结节')).toBeNull();
    // Once profile_2 becomes active, the urgent inactive subtitle should no longer be visible.
    expect(screen.queryByText('3天后!')).toBeNull();
  });

  it('routes into /record/upload from the empty-home state (no profiles)', async () => {
    const { router } = require('expo-router');
    listProfilesMock.mockResolvedValueOnce([] as any);

    renderWithQueryClient(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('暂无档案')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('添加第一个病灶记录'));
    expect(router.push).toHaveBeenCalledWith('/record/upload');
  });

  it('routes into /record/upload from the empty-lesion state (profile exists, no lesions)', async () => {
    const { router } = require('expo-router');
    listProfilesMock.mockResolvedValueOnce([{ id: 'profile_1', nickname: '本人' } as any]);
    listLesionsByProfileMock.mockImplementation(async (profileId) => {
      if (profileId !== 'profile_1') return [];
      return [];
    });
    listActiveRemindersByProfileMock.mockImplementation(async () => []);

    renderWithQueryClient(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('暂无病灶记录')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('添加第一个病灶记录'));
    expect(router.push).toHaveBeenCalledWith('/record/upload');
  });
});

