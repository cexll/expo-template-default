import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import LesionDetailPage from '@/app/lesion/[id]';

const mockUseLocalSearchParams = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: any[]) => mockRouterBack(...args),
    canGoBack: (...args: any[]) => mockRouterCanGoBack(...args),
    replace: (...args: any[]) => mockRouterReplace(...args),
    push: (...args: any[]) => mockRouterPush(...args),
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
const mockUseRemindersByLesion = jest.fn();

jest.mock('@/hooks/useLesions', () => ({
  useLesion: (id: string) => mockUseLesion(id),
}));

jest.mock('@/hooks/useExaminations', () => ({
  useExaminations: (lesionId: string) => mockUseExaminations(lesionId),
}));

jest.mock('@/hooks/useReminders', () => ({
  useRemindersByLesion: (lesionId: string) => mockUseRemindersByLesion(lesionId),
}));

describe('LesionDetailPage', () => {
  beforeEach(() => {
    mockRouterCanGoBack.mockReturnValue(true);
    mockUseRemindersByLesion.mockReturnValue({ data: [] });
  });

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

    expect(screen.getByLabelText('返回上一层')).toBeTruthy();
    expect(screen.getByText('甲状腺左叶结节')).toBeTruthy();
    expect(screen.getByText('暂无检查记录')).toBeTruthy();
    expect(screen.queryByText('检查记录')).toBeNull();
  });

  it('renders seeded repository detail state for browser review evidence', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1', recordSaved: '1' });
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
          id: 'exam-latest',
          lesion_id: 'lesion-1',
          exam_date: '2024-03-15',
          hospital: '北京协和医院',
          size_x: 8.3,
          size_y: 5.8,
          size_z: 6.1,
          tirads: '3',
          echo_type: '低回声',
          border: '清晰',
          calcification: '点状强回声',
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
          id: 'exam-prev',
          lesion_id: 'lesion-1',
          exam_date: '2023-09-10',
          hospital: '北京协和医院',
          size_x: 7.8,
          size_y: 5.2,
          size_z: 5.8,
          tirads: '3',
          echo_type: '低回声',
          border: '尚清',
          calcification: '无',
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
          id: 'exam-base',
          lesion_id: 'lesion-1',
          exam_date: '2023-03-05',
          hospital: '北京协和医院',
          size_x: 7.1,
          size_y: null,
          size_z: null,
          tirads: '3',
          echo_type: '低回声',
          border: '清楚',
          calcification: '无',
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
    mockUseRemindersByLesion.mockReturnValue({
      data: [
        {
          id: 'rem-1',
          lesion_id: 'lesion-1',
          next_exam_date: '2026-05-18',
          source: 'auto',
          is_active: 1,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });
    mockUseQuery.mockReturnValue({ data: [] });

    render(<LesionDetailPage />);

    expect(screen.getByText('甲状腺左叶结节')).toBeTruthy();
    expect(screen.getByText('新检查记录已入库，时间轴已更新')).toBeTruthy();
    expect(screen.getByText('检查记录')).toBeTruthy();
    expect(screen.getAllByText('8.3mm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('关键指标').length).toBeGreaterThan(0);
    expect(screen.getAllByText('低回声').length).toBeGreaterThan(0);
    expect(screen.getByText('下次建议复查')).toBeTruthy();
    fireEvent.press(screen.getByText('查看对比'));
    expect(mockRouterPush).toHaveBeenCalledWith('/lesion/lesion-1/compare');
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

    expect(screen.getByText('检查记录')).toBeTruthy();
    expect(screen.getAllByText('8.3mm').length).toBeGreaterThan(0);
    expect(screen.getByText('最新')).toBeTruthy();
    expect(screen.getAllByText('TI-RADS 3').length).toBeGreaterThan(0);
  });

  it('shows baseline-aware hero delta (baseline is earliest exam)', () => {
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
          id: 'exam-latest',
          lesion_id: 'lesion-1',
          exam_date: '2024-03-15',
          hospital: '重庆市第一人民医院',
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
          id: 'exam-baseline',
          lesion_id: 'lesion-1',
          exam_date: '2023-03-05',
          hospital: '重庆市第一人民医院',
          size_x: 7.1,
          size_y: null,
          size_z: null,
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

    expect(screen.getByText('较基线增大')).toBeTruthy();
    expect(screen.getByText('17%')).toBeTruthy();
  });

  it('gates compare CTA and routes add-record with lesion context', () => {
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
          size_y: null,
          size_z: null,
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
          exam_date: '2023-09-10',
          hospital: '北京协和医院',
          size_x: 7.8,
          size_y: null,
          size_z: null,
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

    expect(screen.queryByText('查看对比')).toBeNull();
    fireEvent.press(screen.getByText('新增记录'));

    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/record/upload',
      params: { lesionId: 'lesion-1', diseaseType: 'thyroid' },
    });
  });

  it('renders newest-first timeline with interval labels and avoids synthetic change rows for single-record lesions', () => {
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
          id: 'exam-1',
          lesion_id: 'lesion-1',
          exam_date: '2024-03-15',
          hospital: '北京协和医院',
          size_x: 8.3,
          size_y: null,
          size_z: null,
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

    const view = render(<LesionDetailPage />);

    expect(screen.getByText('检查记录')).toBeTruthy();
    expect(screen.getByText('最新')).toBeTruthy();
    expect(screen.queryByText('较上次')).toBeNull();
    expect(screen.queryByText('较基线')).toBeNull();

    // now with multiple records: should show an interval label
    mockUseExaminations.mockReturnValue({
      data: [
        {
          id: 'exam-latest',
          lesion_id: 'lesion-1',
          exam_date: '2024-03-15',
          hospital: '北京协和医院',
          size_x: 8.3,
          size_y: null,
          size_z: null,
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
          id: 'exam-old',
          lesion_id: 'lesion-1',
          exam_date: '2023-09-10',
          hospital: '北京协和医院',
          size_x: 7.8,
          size_y: null,
          size_z: null,
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

    view.rerender(<LesionDetailPage />);

    expect(screen.getByText('间隔 6个月')).toBeTruthy();
  });

  it('renders the demo-style next review card from active reminders', () => {
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
          id: 'exam-latest',
          lesion_id: 'lesion-1',
          exam_date: '2024-03-15',
          hospital: '重庆市第一人民医院',
          size_x: 8.3,
          size_y: 5.8,
          size_z: 6.1,
          tirads: '3',
          echo_type: null,
          border: null,
          calcification: '点状强回声',
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
          id: 'exam-prev',
          lesion_id: 'lesion-1',
          exam_date: '2023-09-10',
          hospital: '重庆市第一人民医院',
          size_x: 7.8,
          size_y: null,
          size_z: null,
          tirads: '3',
          echo_type: null,
          border: null,
          calcification: '无',
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
    mockUseRemindersByLesion.mockReturnValue({
      data: [
        {
          id: 'rem-1',
          lesion_id: 'lesion-1',
          next_exam_date: '2024-09-15',
          source: 'auto',
          is_active: 1,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });

    render(<LesionDetailPage />);

    expect(screen.getByText('下次建议复查')).toBeTruthy();
    expect(screen.getByText('2024-09-15')).toBeTruthy();
    expect(screen.getByLabelText('修改复查日期')).toBeTruthy();
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
