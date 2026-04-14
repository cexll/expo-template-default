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

const mockPersistReportImageUris = jest.fn();

jest.mock('@/lib/report-image-storage', () => ({
  persistReportImageUris: (...args: any[]) => mockPersistReportImageUris(...args),
}));

const mockCreateReportImage = jest.fn();

jest.mock('@/lib/db/queries/report-images', () => ({
  createReportImage: (...args: any[]) => mockCreateReportImage(...args),
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

  it('auto-selects a >=80% recommendation and allows save without manual selection', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      diseaseType: 'thyroid',
      images: JSON.stringify(['file:///a.png']),
      recognizedData: JSON.stringify({
        location: '左叶中下段',
        size_x: '8.0',
        tirads: '3',
        exam_date: '2024-03-15',
        hospital: '北京协和医院',
      }),
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

    mockUseQueries.mockReturnValue([{ data: [{ size_x: 8.3 }] }]);

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

    mockCreateExaminationMutateAsync.mockImplementation(async (input: any) => ({
      id: input.id,
      lesion_id: input.lesion_id,
      exam_date: input.exam_date,
    }));

    mockPersistReportImageUris.mockResolvedValue(['file:///persisted/a.png']);
    mockCreateReportImage.mockResolvedValue({ id: 'report-image-1' });
    mockListRemindersByLesion.mockResolvedValue([]);
    mockCreateReminderMutateAsync.mockResolvedValue({ id: 'reminder-1' });

    render(<MatchPage />);

    expect(screen.getByText('AI推荐匹配')).toBeTruthy();
    expect(screen.getByText('已选择: 甲状腺左叶结节')).toBeTruthy();

    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockCreateExaminationMutateAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-1');
    });
  });

  it('does not auto-select when top confidence is below 80%', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      diseaseType: 'thyroid',
      images: JSON.stringify(['file:///a.png']),
      recognizedData: JSON.stringify({
        location: '左叶中下段',
        size_x: '8.0',
        tirads: '3',
        exam_date: '2024-03-15',
      }),
    });

    mockUseLesions.mockReturnValue({
      data: [
        {
          id: 'lesion-1',
          profile_id: 'profile-1',
          disease_type: 'thyroid',
          label: '甲状腺右叶结节',
          location: '右叶上段',
          is_archived: 0,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    mockUseQueries.mockReturnValue([{ data: [{ size_x: 20.0 }] }]);

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

    render(<MatchPage />);

    expect(screen.getByText('已选择: 请选择病灶')).toBeTruthy();
    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockCreateExaminationMutateAsync).not.toHaveBeenCalled();
    });
  });

  it('creates an examination for an existing lesion and then creates an auto reminder', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      diseaseType: 'thyroid',
      images: JSON.stringify(['file:///a.png', 'file:///b.png']),
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

    mockCreateExaminationMutateAsync.mockImplementation(async (input: any) => ({
      id: input.id,
      lesion_id: input.lesion_id,
      exam_date: input.exam_date,
    }));

    mockPersistReportImageUris.mockResolvedValue(['file:///persisted/a.png', 'file:///persisted/b.png']);
    mockCreateReportImage.mockResolvedValue({ id: 'report-image-1' });
    mockListRemindersByLesion.mockResolvedValue([]);
    mockCreateReminderMutateAsync.mockResolvedValue({ id: 'reminder-1' });

    render(<MatchPage />);

    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockCreateExaminationMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockPersistReportImageUris).toHaveBeenCalledTimes(1);
      expect(mockCreateReportImage).toHaveBeenCalledTimes(2);
      expect(mockCreateReminderMutateAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-1');
    });

    const examInput = mockCreateExaminationMutateAsync.mock.calls[0]?.[0];
    expect(mockPersistReportImageUris).toHaveBeenCalledWith(['file:///a.png', 'file:///b.png'], examInput.id);

    expect(mockCreateReportImage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        examination_id: examInput.id,
        uri: 'file:///persisted/a.png',
        sort_order: 0,
      })
    );
    expect(mockCreateReportImage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        examination_id: examInput.id,
        uri: 'file:///persisted/b.png',
        sort_order: 1,
      })
    );

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

  it('creates a new lesion then persists examination and report images under it', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      diseaseType: 'breast',
      images: JSON.stringify(['file:///r1.png']),
      recognizedData: JSON.stringify({
        location: '右乳10点钟',
        size_x: '6.0',
        birads: '3',
        exam_date: '2025-01-20',
        hospital: '复旦大学附属肿瘤医院',
      }),
    });

    mockUseLesions.mockReturnValue({
      data: [
        {
          id: 'lesion-old',
          profile_id: 'profile-1',
          disease_type: 'breast',
          label: '乳腺右乳结节',
          location: '右乳8点钟',
          is_archived: 0,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    mockUseQueries.mockReturnValue([{ data: [{ size_x: 7.1 }] }]);

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

    mockCreateLesionMutateAsync.mockResolvedValue({
      id: 'lesion-new',
    });
    mockCreateExaminationMutateAsync.mockImplementation(async (input: any) => ({
      id: input.id,
      lesion_id: input.lesion_id,
      exam_date: input.exam_date,
    }));
    mockPersistReportImageUris.mockResolvedValue(['file:///persisted/r1.png']);
    mockCreateReportImage.mockResolvedValue({ id: 'report-image-1' });
    mockListRemindersByLesion.mockResolvedValue([]);
    mockCreateReminderMutateAsync.mockResolvedValue({ id: 'reminder-1' });

    render(<MatchPage />);

    fireEvent.press(screen.getByText('新建病灶'));
    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockCreateLesionMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockCreateExaminationMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockCreateReportImage).toHaveBeenCalledTimes(1);
    });

    const lesionInput = mockCreateLesionMutateAsync.mock.calls[0]?.[0];
    expect(lesionInput).toMatchObject({
      profile_id: 'profile-1',
      disease_type: 'breast',
    });

    const examInput = mockCreateExaminationMutateAsync.mock.calls[0]?.[0];
    expect(examInput).toMatchObject({
      lesion_id: 'lesion-new',
      hospital: '复旦大学附属肿瘤医院',
      size_x: 6.0,
      birads: '3',
      exam_date: '2025-01-20',
    });

    expect(mockCreateReportImage).toHaveBeenCalledWith(
      expect.objectContaining({
        examination_id: examInput.id,
        uri: 'file:///persisted/r1.png',
        sort_order: 0,
      })
    );

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-new');
    });
  });
});
