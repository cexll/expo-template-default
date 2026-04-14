import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RemindersPage from '@/app/(main)/reminders';
import { listProfiles } from '@/lib/db/queries/profiles';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockPush,
    replace: jest.fn(),
  },
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

jest.mock('@/providers/active-profile-provider', () => ({
  useActiveProfile: () => ({
    activeProfileId: 'profile_1',
    setActiveProfileId: jest.fn(),
  }),
}));

const listProfilesMock = jest.mocked(listProfiles);
const listLesionsByProfileMock = jest.mocked(listLesionsByProfile);
const listActiveRemindersByProfileMock = jest.mocked(listActiveRemindersByProfile);

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

describe('RemindersPage UI parity', () => {
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
          id: 'lesion_soon',
          profile_id: 'profile_1',
          disease_type: 'thyroid',
          label: '左叶结节',
          location: '左叶',
          is_archived: 0,
        } as any,
        {
          id: 'lesion_unset',
          profile_id: 'profile_1',
          disease_type: 'lung',
          label: '右肺结节',
          location: '右肺',
          is_archived: 0,
        } as any,
      ];
    });

    listActiveRemindersByProfileMock.mockImplementation(async (profileId) => {
      if (profileId !== 'profile_1') return [];
      return [
        {
          id: 'reminder_1',
          lesion_id: 'lesion_soon',
          next_exam_date: isoDaysFromNow(5),
          source: 'auto',
          is_active: 1,
        } as any,
      ];
    });
  });

  it("splits reminders into '即将到期' and '其他提醒' and includes the unset reminder path", async () => {
    renderWithQueryClient(<RemindersPage />);

    await waitFor(() => {
      expect(screen.getByText('即将到期')).toBeTruthy();
      expect(screen.getByText('其他提醒')).toBeTruthy();
    });

    expect(screen.getByText('左叶结节')).toBeTruthy();
    expect(screen.getByText('右肺结节')).toBeTruthy();

    expect(screen.getByText('未设置')).toBeTruthy();
    expect(screen.getByText('— 暂未生成')).toBeTruthy();
    expect(screen.getByText('去新增记录 ›')).toBeTruthy();
  });
});

