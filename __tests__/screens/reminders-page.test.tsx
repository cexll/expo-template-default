import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import RemindersPage from '@/app/(main)/reminders';
import { listProfiles } from '@/lib/db/queries/profiles';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { createReminder, deactivateReminder, listActiveRemindersByProfile, updateReminder } from '@/lib/db/queries/reminders';
import { listLatestExaminationsByProfile } from '@/lib/db/queries/examinations';
import { api } from '@/lib/api';
import { applyReminderSideEffects } from '@/lib/reminder-side-effects';

const mockPush = jest.fn();

const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: mockPush,
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@/lib/db/queries/profiles', () => ({
  listProfiles: jest.fn(),
}));

jest.mock('@/lib/db/queries/lesions', () => ({
  listLesionsByProfile: jest.fn(),
}));

jest.mock('@/lib/db/queries/reminders', () => ({
  listActiveRemindersByProfile: jest.fn(),
  createReminder: jest.fn(),
  updateReminder: jest.fn(),
  deactivateReminder: jest.fn(),
}));

jest.mock('@/lib/db/queries/examinations', () => ({
  listLatestExaminationsByProfile: jest.fn(),
}));

jest.mock('@/lib/reminder-side-effects', () => ({
  applyReminderSideEffects: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
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
const listLatestExaminationsByProfileMock = jest.mocked(listLatestExaminationsByProfile);
const createReminderMock = jest.mocked(createReminder);
const updateReminderMock = jest.mocked(updateReminder);
const deactivateReminderMock = jest.mocked(deactivateReminder);
const apiPostMock = jest.mocked(api.post);
const apiGetMock = jest.mocked(api.get);
const applyReminderSideEffectsMock = jest.mocked(applyReminderSideEffects);

function renderWithQueryClient(node: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
      mutations: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

describe('RemindersPage UI parity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({});
    applyReminderSideEffectsMock.mockResolvedValue({
      notification: { supported: false, permission: 'unsupported' },
      sync: { ok: true, sent: 1 },
    });
    apiPostMock.mockResolvedValue({});
    apiGetMock.mockResolvedValue({ reminders: [{ lesion_label: '左叶结节', next_exam_date: '2026-05-01' }] });

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

    listLatestExaminationsByProfileMock.mockResolvedValue([
      {
        id: 'exam_1',
        lesion_id: 'lesion_unset',
        exam_date: '2024-03-15',
        tirads: null,
        birads: null,
        lung_rads: '4X',
      } as any,
    ]);
  });

  it('renders UI-005 prototype reminder state without stored profile data', async () => {
    mockUseLocalSearchParams.mockReturnValue({ prototypeUi005Seed: 'demo' });
    listProfilesMock.mockResolvedValue([]);
    listLesionsByProfileMock.mockResolvedValue([]);
    listActiveRemindersByProfileMock.mockResolvedValue([]);
    listLatestExaminationsByProfileMock.mockResolvedValue([]);

    renderWithQueryClient(<RemindersPage />);

    await waitFor(() => {
      expect(screen.getByText('随访提醒')).toBeTruthy();
      expect(screen.getByText('左叶中下段结节')).toBeTruthy();
      expect(screen.getByText('右乳10点钟结节')).toBeTruthy();
      expect(screen.getByText('右上叶前段结节')).toBeTruthy();
      expect(screen.getAllByText('层级（规划）').length).toBeGreaterThan(0);
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
    expect(screen.getByText('提醒已开启 · 4层提醒')).toBeTruthy();
    expect(screen.getByText('— 暂未设置')).toBeTruthy();
    expect(screen.getByText('设置提醒 ›')).toBeTruthy();

    // Active reminder cards expose edit/deactivate affordances.
    expect(screen.getByText('修改日期 ›')).toBeTruthy();
    expect(screen.getByText('停用')).toBeTruthy();
  });

  it('rejects impossible calendar dates on manual edit', async () => {
    renderWithQueryClient(<RemindersPage />);

    await waitFor(() => {
      expect(screen.getByText('修改日期 ›')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('修改日期 ›'));

    fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2026-02-31');
    fireEvent.press(screen.getByText('保存'));

    expect(screen.getByText('请输入正确的日期（YYYY-MM-DD）')).toBeTruthy();
    expect(updateReminderMock).not.toHaveBeenCalled();
    expect(createReminderMock).not.toHaveBeenCalled();
    expect(deactivateReminderMock).not.toHaveBeenCalled();
  });

  it('exposes a deterministic INT-003 sync/readback browser probe only when seeded', async () => {
    mockUseLocalSearchParams.mockReturnValue({ prototypeInt003Seed: 'demo' });
    apiGetMock.mockResolvedValueOnce({ reminders: [{ lesion_label: '左叶结节', next_exam_date: '2026-05-01' }] });

    renderWithQueryClient(<RemindersPage />);

    await waitFor(() => {
      expect(screen.getByText('VAL-INT-003 浏览器证据探针')).toBeTruthy();
      expect(screen.getByText('本地提醒：左叶结节 · ' + isoDaysFromNow(5) + ' · 自动推导')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('同步并读回后端提醒'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/api/v1/reminders/sync', {
        reminders: [{ lesion_label: '左叶结节', next_exam_date: isoDaysFromNow(5) }],
      });
      expect(apiGetMock).toHaveBeenCalledWith('/api/v1/reminders');
      expect(screen.getByText('后端读回：左叶结节 · 2026-05-01')).toBeTruthy();
    });
  });

  it('retains success feedback after saving an updated reminder date', async () => {
    updateReminderMock.mockResolvedValue(undefined as any);

    renderWithQueryClient(<RemindersPage />);

    await waitFor(() => {
      expect(screen.getByText('修改日期 ›')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('修改日期 ›'));
    fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2026-05-01');
    fireEvent.press(screen.getByText('保存'));

    await waitFor(() => {
      expect(updateReminderMock).toHaveBeenCalledWith('reminder_1', {
        next_exam_date: '2026-05-01',
        source: 'manual',
        is_active: 1,
      });
      expect(applyReminderSideEffectsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('YYYY-MM-DD')).toBeNull();
    });

    expect(screen.getByText('已同步提醒（通知权限：unsupported）')).toBeTruthy();
  });

  it('retains success feedback after deactivating a reminder via empty save', async () => {
    deactivateReminderMock.mockResolvedValue(undefined as any);

    renderWithQueryClient(<RemindersPage />);

    await waitFor(() => {
      expect(screen.getByText('修改日期 ›')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('修改日期 ›'));
    fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '   ');
    fireEvent.press(screen.getByText('保存'));

    await waitFor(() => {
      expect(deactivateReminderMock).toHaveBeenCalledWith('reminder_1');
      expect(applyReminderSideEffectsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('YYYY-MM-DD')).toBeNull();
    });

    expect(screen.getByText('已同步提醒（通知权限：unsupported）')).toBeTruthy();
  });
});

