import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MatchPage from '@/app/record/match';

const mockSaveMatchRecordAtomic = jest.fn();
const mockUseLesion = jest.fn();
const mockUseSubscriptionStatus = jest.fn();

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

const mockCreateLesion = jest.fn(async () => null);
const mockCreateExamination = jest.fn(async () => null);
const mockCreateReportImage = jest.fn(async () => null);
const mockCreateReminder = jest.fn(async () => null);

jest.mock('@/lib/db/queries/lesions', () => ({
  createLesion: (...args: any[]) => mockCreateLesion(...args),
}));

jest.mock('@/lib/db/queries/examinations', () => ({
  listExaminationsByLesion: jest.fn(),
  createExamination: (...args: any[]) => mockCreateExamination(...args),
}));

jest.mock('@/lib/db/queries/report-images', () => ({
  createReportImage: (...args: any[]) => mockCreateReportImage(...args),
}));

jest.mock('@/lib/db/queries/reminders', () => ({
  createReminder: (...args: any[]) => mockCreateReminder(...args),
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
  useLesion: (id: string) => mockUseLesion(id),
}));

jest.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockUseSubscriptionStatus(),
}));

describe('MatchPage', () => {
  beforeEach(() => {
    mockUseLesion.mockReturnValue({ data: null });
    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('matches the demo lesion matching hierarchy and selection footer', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      diseaseType: 'thyroid',
      images: JSON.stringify(['file:///a.png', 'file:///b.png']),
      recognizedData: JSON.stringify({
        location: '左叶中下段',
        size_x: '8.3',
        tirads: '3',
        echo_type: '低回声',
        border: '清晰',
        exam_date: '2024-03-15',
      }),
    });

    mockUseLesions.mockReturnValue({
      data: [
        {
          id: 'lesion-1',
          profile_id: 'profile-1',
          disease_type: 'thyroid',
          label: '左叶中下段结节',
          location: '左叶中下段',
          is_archived: 0,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
        {
          id: 'lesion-2',
          profile_id: 'profile-1',
          disease_type: 'thyroid',
          label: '右叶结节',
          location: '右叶',
          is_archived: 0,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    mockUseQueries.mockReturnValue([
      { data: [{ size_x: 7.8, rads_grade: '3', exam_date: '2023-09-10' }] },
      { data: [{ size_x: 5.2, rads_grade: '2', exam_date: '2023-03-05' }] },
    ]);

    render(<MatchPage />);

    expect(screen.getByText('本次识别结果')).toBeTruthy();
    expect(screen.getByText('甲状腺结节')).toBeTruthy();
    expect(screen.getByText('左叶中下段 · TI-RADS 3级')).toBeTruthy();
    expect(screen.getByText('8.3mm')).toBeTruthy();
    expect(screen.getByText('低回声')).toBeTruthy();
    expect(screen.getByText('AI 建议匹配')).toBeTruthy();
    expect(screen.getByText('根据部位和大小自动匹配，请确认')).toBeTruthy();
    expect(screen.getByText('AI推荐')).toBeTruthy();
    expect(screen.getByText('匹配置信度')).toBeTruthy();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('或选择其他已有病灶')).toBeTruthy();
    expect(screen.getByText('右叶结节')).toBeTruthy();
    expect(screen.getByText('新建病灶')).toBeTruthy();
    expect(screen.getByText('这是一个新发现的结节')).toBeTruthy();
    expect(screen.getByText('已选择：左叶中下段结节')).toBeTruthy();
    expect(screen.getByText('确认匹配，完成录入')).toBeTruthy();

    fireEvent.press(screen.getByText('右叶结节'));
    expect(screen.getByText('已选择：右叶结节')).toBeTruthy();

    fireEvent.press(screen.getByText('新建病灶'));
    expect(screen.getByText('已选择：新建病灶')).toBeTruthy();
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

    expect(screen.getByText('AI推荐')).toBeTruthy();
    expect(screen.getByText('已选择：甲状腺左叶结节')).toBeTruthy();

    fireEvent.press(screen.getByText('确认匹配，完成录入'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-1');
    });
  });

  it('disables save while subscription status is loading', async () => {
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

    mockUseSubscriptionStatus.mockReturnValue({ data: undefined, isLoading: true });
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

    render(<MatchPage />);

    expect(screen.getByText('权益加载中...')).toBeTruthy();
    fireEvent.press(screen.getByText('权益加载中...'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).not.toHaveBeenCalled();
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

    expect(screen.getByText('已选择：请选择病灶')).toBeTruthy();
    fireEvent.press(screen.getByText('确认匹配，完成录入'));

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

    fireEvent.press(screen.getByText('确认匹配，完成录入'));

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
    fireEvent.press(screen.getByText('确认匹配，完成录入'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-new');
    });
  });

  it('locks selection to lesionId even if disease filtering or candidate list would exclude it', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      lesionId: 'lesion-locked',
      diseaseType: 'lung', // attempt to drift disease type
      images: JSON.stringify(['file:///a.png']),
      recognizedData: JSON.stringify({
        location: '左叶中下段',
        size_x: '8.0',
        tirads: '3',
        exam_date: '2024-03-15',
      }),
    });

    // Candidate lesions do NOT include the locked lesion (e.g., due to active profile or disease filter drift).
    mockUseLesions.mockReturnValue({
      data: [
        {
          id: 'lesion-other',
          profile_id: 'profile-1',
          disease_type: 'lung',
          label: '肺右上叶结节',
          location: '右上叶前段',
          is_archived: 0,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-locked',
        profile_id: 'profile-2',
        disease_type: 'thyroid',
        label: '甲状腺左叶结节',
        location: '左叶中下段',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });

    mockUseQueries.mockReturnValue([{ data: [{ size_x: 8.3 }] }]);

    mockSaveMatchRecordAtomic.mockResolvedValue({ lesionId: 'lesion-locked', examinationId: 'exam-1' });

    render(<MatchPage />);

    expect(screen.getByText('新增记录')).toBeTruthy();
    expect(screen.getByText('已选择：甲状腺左叶结节')).toBeTruthy();
    expect(screen.queryByText('新建病灶')).toBeNull();

    fireEvent.press(screen.getByText('确认匹配，完成录入'));

    await waitFor(() => {
      expect(mockSaveMatchRecordAtomic).toHaveBeenCalledTimes(1);
    });

    const call = mockSaveMatchRecordAtomic.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      createNew: false,
      diseaseType: 'thyroid',
      selectedLesionId: 'lesion-locked',
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/lesion/lesion-locked');
    });
  });
});
