import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import HomePage from '@/app/(main)/index';
import { ActiveProfileProvider } from '@/providers/active-profile-provider';
import { api } from '@/lib/api';
import { listProfiles } from '@/lib/db/queries/profiles';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';

let mockPathname = '/';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  usePathname: () => mockPathname,
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
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

const listProfilesMock = jest.mocked(listProfiles);
const listLesionsByProfileMock = jest.mocked(listLesionsByProfile);
const listActiveRemindersByProfileMock = jest.mocked(listActiveRemindersByProfile);
const listExaminationsByLesionMock = jest.mocked(listExaminationsByLesion);
const apiGetMock = jest.mocked(api.get);

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });

  const buildNode = () => (
    <QueryClientProvider client={queryClient}>
      <ActiveProfileProvider>
        <HomePage />
      </ActiveProfileProvider>
    </QueryClientProvider>
  );

  return { queryClient, buildNode, ...render(buildNode()) };
}

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

describe('Home bootstrap default-profile semantics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/';
    try {
      globalThis.localStorage?.clear();
    } catch {
      // ignore
    }

    apiGetMock.mockResolvedValue({
      plan: 'free',
      is_active: false,
      ai_recognize_remaining: 2,
      expires_at: null,
    } as any);

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

    listActiveRemindersByProfileMock.mockImplementation(async () => []);

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
  });

  it('defaults home to the first stored profile on mount/reload, without clobbering the persisted active profile id, and preserves continuity after explicit switching', async () => {
    globalThis.localStorage?.setItem('active_profile_id', 'profile_2');

    const tree = renderHome();

    await waitFor(() => {
      expect(screen.getByText('本人')).toBeTruthy();
      expect(screen.getByText('妈妈')).toBeTruthy();
    });

    // Home should render profile_1 by default even if the stored active profile was profile_2.
    await waitFor(() => {
      expect(screen.getByText('左叶结节')).toBeTruthy();
    });
    expect(screen.queryByText('右乳结节')).toBeNull();
    expect(globalThis.localStorage?.getItem('active_profile_id')).toBe('profile_2');

    // Explicit switching should override the visible selection and remain stable for subsequent renders.
    fireEvent.press(screen.getByTestId('profile-switcher-chip-profile_2'));

    await waitFor(() => {
      expect(screen.getByText('右乳结节')).toBeTruthy();
    });
    expect(screen.queryByText('左叶结节')).toBeNull();

    tree.rerender(tree.buildNode());

    await waitFor(() => {
      expect(screen.getByText('右乳结节')).toBeTruthy();
    });
    expect(screen.queryByText('左叶结节')).toBeNull();

    // A remount (simulated reload) should again default home back to the first stored profile.
    tree.unmount();
    renderHome();

    await waitFor(() => {
      expect(screen.getByText('左叶结节')).toBeTruthy();
    });
    expect(screen.queryByText('右乳结节')).toBeNull();
  });

  it('re-applies the first-profile default when returning to Home in the same session', async () => {
    globalThis.localStorage?.setItem('active_profile_id', 'profile_2');

    const tree = renderHome();

    await waitFor(() => {
      expect(screen.getByText('左叶结节')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('profile-switcher-chip-profile_2'));

    await waitFor(() => {
      expect(screen.getByText('右乳结节')).toBeTruthy();
    });

    // Simulate navigating away and then returning to home without a full reload.
    mockPathname = '/settings';
    await act(async () => {
      tree.rerender(tree.buildNode());
    });

    mockPathname = '/';
    await act(async () => {
      tree.rerender(tree.buildNode());
    });

    await waitFor(() => {
      expect(screen.getByText('左叶结节')).toBeTruthy();
    });
    expect(screen.queryByText('右乳结节')).toBeNull();
  });
});
