import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MatchPage from '@/app/record/match';

const mockSaveMatchRecordAtomic = jest.fn();

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

jest.mock('@/lib/db/save-match-record', () => ({
  saveMatchRecordAtomic: (...args: any[]) => mockSaveMatchRecordAtomic(...args),
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

const mockUseLesions = jest.fn();

jest.mock('@/hooks/useLesions', () => ({
  useLesions: () => mockUseLesions(),
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

    mockSaveMatchRecordAtomic.mockResolvedValue({ lesionId: 'lesion-1', examinationId: 'exam-1' });

    render(<MatchPage />);

    expect(screen.getByText('AI推荐匹配')).toBeTruthy();
    expect(screen.getByText('已选择: 甲状腺左叶结节')).toBeTruthy();

    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).toHaveBeenCalledTimes(1);
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

    render(<MatchPage />);

    expect(screen.getByText('已选择: 请选择病灶')).toBeTruthy();
    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).not.toHaveBeenCalled();
    });
  });

  it('surfaces save failures as 入库失败 and does not navigate', async () => {
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

    mockSaveMatchRecordAtomic.mockRejectedValue(new Error('入库失败'));

    render(<MatchPage />);

    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('入库失败')).toBeTruthy();
    });

    expect(router.replace).not.toHaveBeenCalled();
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

    mockSaveMatchRecordAtomic.mockResolvedValue({ lesionId: 'lesion-new', examinationId: 'exam-2' });

    render(<MatchPage />);

    fireEvent.press(screen.getByText('新建病灶'));
    fireEvent.press(screen.getByText('确认入库'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-new');
    });
  });
});
