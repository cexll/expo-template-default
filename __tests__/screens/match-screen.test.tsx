import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MatchPage from '@/app/record/match';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/providers/active-profile-provider', () => ({
  useActiveProfile: () => ({
    activeProfileId: 'profile-1',
    setActiveProfileId: jest.fn(),
  }),
}));

const mockInvalidateQueries = jest.fn();
const mockUseQueries = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
    useQueries: (args: any) => mockUseQueries(args),
  };
});

const mockUseProfiles = jest.fn();
const mockUseLesions = jest.fn();

const mockCreateExaminationMutateAsync = jest.fn();
const mockUseCreateExamination = jest.fn();

const mockUseCreateLesion = jest.fn();
const mockCreateLesionMutateAsync = jest.fn();

const mockUseCreateReminder = jest.fn();
const mockCreateReminderMutateAsync = jest.fn();

jest.mock('@/hooks/useProfiles', () => ({
  useProfiles: () => mockUseProfiles(),
}));

jest.mock('@/hooks/useLesions', () => ({
  useLesions: () => mockUseLesions(),
  useCreateLesion: () => mockUseCreateLesion(),
}));

jest.mock('@/hooks/useExaminations', () => ({
  useCreateExamination: () => mockUseCreateExamination(),
}));

jest.mock('@/hooks/useReminders', () => ({
  useCreateReminder: () => mockUseCreateReminder(),
}));

const mockListRemindersByLesion = jest.fn();
const mockUpdateReminder = jest.fn();

jest.mock('@/lib/db/queries/reminders', () => ({
  listRemindersByLesion: (...args: any[]) => mockListRemindersByLesion(...args),
  updateReminder: (...args: any[]) => mockUpdateReminder(...args),
}));

describe('MatchPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates an examination for an existing lesion and then creates an auto reminder', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      diseaseType: 'thyroid',
      recognizedData: JSON.stringify({
        location: '左叶中下段',
        size_x: '8.3',
        size_y: '5.8',
        size_z: '6.1',
        tirads: '3',
        exam_date: '2024-03-15',
        hospital: '北京协和医院',
      }),
    });

    mockUseProfiles.mockReturnValue({
      data: [{ id: 'profile-1', nickname: '本人', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 }],
    });

    mockUseLesions.mockReturnValue({
      data: [
        {
          id: 'lesion-1',
          profile_id: 'profile-1',
          disease_type: 'thyroid',
          label: '甲状腺左叶结节',
          location: '左叶中下段',
          is_archived: 0,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    mockUseQueries.mockReturnValue([{ data: [{ size_x: 7.5 }] }]);

    mockUseCreateLesion.mockReturnValue({
      mutateAsync: mockCreateLesionMutateAsync,
      isPending: false,
    });
    mockUseCreateExamination.mockReturnValue({
      mutateAsync: mockCreateExaminationMutateAsync,
      isPending: false,
    });
    mockUseCreateReminder.mockReturnValue({
      mutateAsync: mockCreateReminderMutateAsync,
      isPending: false,
    });

    mockCreateExaminationMutateAsync.mockResolvedValue({
      id: 'exam-1',
      lesion_id: 'lesion-1',
      exam_date: '2024-03-15',
    });
    mockListRemindersByLesion.mockResolvedValue([]);
    mockCreateReminderMutateAsync.mockResolvedValue({ id: 'reminder-1' });

    render(<MatchPage />);

    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockCreateExaminationMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockCreateReminderMutateAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-1');
    });

    expect(mockCreateExaminationMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        lesion_id: 'lesion-1',
        hospital: '北京协和医院',
        size_x: 8.3,
        size_y: 5.8,
        size_z: 6.1,
        tirads: '3',
        exam_date: '2024-03-15',
      })
    );

    expect(mockListRemindersByLesion).toHaveBeenCalledWith('lesion-1');
    expect(mockUpdateReminder).not.toHaveBeenCalled();

    expect(mockCreateReminderMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        lesion_id: 'lesion-1',
        source: 'auto',
        is_active: 1,
      })
    );
  });
});
