import React from 'react';
import { render, screen } from '@testing-library/react-native';

import LesionDetailPage from '@/app/lesion/[id]';

const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (args: any) => mockUseQuery(args),
  };
});

const mockUseLesion = jest.fn();
const mockUseExaminations = jest.fn();

jest.mock('@/hooks/useLesions', () => ({
  useLesion: (id: string) => mockUseLesion(id),
}));

jest.mock('@/hooks/useExaminations', () => ({
  useExaminations: (lesionId: string) => mockUseExaminations(lesionId),
}));

describe('LesionDetailPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when there are no examinations', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '甲状腺左叶结节',
        location: '左叶中下段',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({ data: [] });
    mockUseQuery.mockReturnValue({ data: [] });

    render(<LesionDetailPage />);

    expect(screen.getByText('甲状腺左叶结节')).toBeTruthy();
    expect(screen.getByText('暂无检查记录')).toBeTruthy();
  });

  it('renders latest values and timeline from real examination data', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '甲状腺左叶结节',
        location: '左叶中下段',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        {
          id: 'exam-2',
          lesion_id: 'lesion-1',
          exam_date: '2024-03-15',
          hospital: '北京协和医院',
          size_x: 8.3,
          size_y: 5.8,
          size_z: 6.1,
          tirads: '3',
          echo_type: null,
          border: null,
          calcification: null,
          blood_flow: null,
          birads: null,
          shape: null,
          orientation: null,
          lung_rads: null,
          density: null,
          morphology: null,
          pleural_pull: null,
          ai_raw_json: null,
          notes: null,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
        {
          id: 'exam-1',
          lesion_id: 'lesion-1',
          exam_date: '2023-09-15',
          hospital: '北京协和医院',
          size_x: 7.5,
          size_y: 5.2,
          size_z: 5.8,
          tirads: '3',
          echo_type: null,
          border: null,
          calcification: null,
          blood_flow: null,
          birads: null,
          shape: null,
          orientation: null,
          lung_rads: null,
          density: null,
          morphology: null,
          pleural_pull: null,
          ai_raw_json: null,
          notes: null,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });
    mockUseQuery.mockReturnValue({ data: [] });

    render(<LesionDetailPage />);

    expect(screen.getByText('检查时间线')).toBeTruthy();
    expect(screen.getAllByText('8.3×5.8×6.1mm').length).toBeGreaterThan(0);
    expect(screen.getByText('最新')).toBeTruthy();
    expect(screen.getAllByText('TI-RADS 3').length).toBeGreaterThan(0);
  });

  it('shows persisted report image thumbnails for examinations', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '甲状腺左叶结节',
        location: '左叶中下段',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        {
          id: 'exam-2',
          lesion_id: 'lesion-1',
          exam_date: '2024-03-15',
          hospital: '北京协和医院',
          size_x: 8.3,
          size_y: 5.8,
          size_z: 6.1,
          tirads: '3',
          echo_type: null,
          border: null,
          calcification: null,
          blood_flow: null,
          birads: null,
          shape: null,
          orientation: null,
          lung_rads: null,
          density: null,
          morphology: null,
          pleural_pull: null,
          ai_raw_json: null,
          notes: null,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
        {
          id: 'exam-1',
          lesion_id: 'lesion-1',
          exam_date: '2023-09-15',
          hospital: '北京协和医院',
          size_x: 7.5,
          size_y: 5.2,
          size_z: 5.8,
          tirads: '3',
          echo_type: null,
          border: null,
          calcification: null,
          blood_flow: null,
          birads: null,
          shape: null,
          orientation: null,
          lung_rads: null,
          density: null,
          morphology: null,
          pleural_pull: null,
          ai_raw_json: null,
          notes: null,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    mockUseQuery.mockReturnValue({
      data: [
        {
          id: 'report-1',
          examination_id: 'exam-2',
          uri: 'file:///persisted/report-1.png',
          sort_order: 0,
          created_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    render(<LesionDetailPage />);

    expect(screen.getByLabelText('检查exam-2报告图片1')).toBeTruthy();
  });
});
