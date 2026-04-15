import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ComparePage from '@/app/lesion/[id]/compare';

const mockUseLocalSearchParams = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: any[]) => mockRouterReplace(...args),
    push: (...args: any[]) => mockRouterPush(...args),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

const mockUseLesion = jest.fn();
const mockUseExaminations = jest.fn();
const mockUseRemindersByLesion = jest.fn();
const mockCreateReminderMutateAsync = jest.fn();
const mockUpdateReminderMutateAsync = jest.fn();
const mockDeactivateReminderMutateAsync = jest.fn();

jest.mock('@/hooks/useLesions', () => ({
  useLesion: (id: string) => mockUseLesion(id),
}));

jest.mock('@/hooks/useExaminations', () => ({
  useExaminations: (lesionId: string) => mockUseExaminations(lesionId),
}));

jest.mock('@/hooks/useReminders', () => ({
  useRemindersByLesion: (lesionId: string) => mockUseRemindersByLesion(lesionId),
  useCreateReminder: () => ({ mutateAsync: mockCreateReminderMutateAsync, isPending: false }),
  useUpdateReminder: () => ({ mutateAsync: mockUpdateReminderMutateAsync, isPending: false }),
  useDeactivateReminder: () => ({ mutateAsync: mockDeactivateReminderMutateAsync, isPending: false }),
}));

jest.mock('@/lib/reminder-side-effects', () => ({
  applyReminderSideEffects: async () => ({
    notification: { supported: false, permission: 'unsupported' },
    sync: { ok: true, sent: 0 },
  }),
}));

function buildExam(overrides: Partial<any>) {
  return {
    id: overrides.id ?? 'exam',
    lesion_id: overrides.lesion_id ?? 'lesion-1',
    exam_date: overrides.exam_date ?? '2024-03-15',
    hospital: null,
    size_x: overrides.size_x ?? null,
    size_y: overrides.size_y ?? null,
    size_z: overrides.size_z ?? null,
    tirads: overrides.tirads ?? null,
    echo_type: overrides.echo_type ?? null,
    border: overrides.border ?? null,
    calcification: overrides.calcification ?? null,
    blood_flow: null,
    birads: overrides.birads ?? null,
    shape: overrides.shape ?? null,
    orientation: overrides.orientation ?? null,
    lung_rads: overrides.lung_rads ?? null,
    density: overrides.density ?? null,
    morphology: overrides.morphology ?? null,
    pleural_pull: overrides.pleural_pull ?? null,
    ai_raw_json: null,
    notes: null,
    created_at: '2026-04-13T00:00:00.000Z',
    updated_at: '2026-04-13T00:00:00.000Z',
  };
}

describe('ComparePage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fails safely on missing id', () => {
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseLesion.mockReturnValue({ data: undefined });
    mockUseExaminations.mockReturnValue({ data: [] });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });

    render(<ComparePage />);

    expect(screen.getByText('病灶 ID 无效')).toBeTruthy();
  });

  it('fails safely on missing lesion', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({ data: undefined });
    mockUseExaminations.mockReturnValue({ data: [] });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });

    render(<ComparePage />);

    expect(screen.getByText('未找到该病灶')).toBeTruthy();
    expect(screen.getByText('返回首页')).toBeTruthy();
  });

  it('guards insufficient history with explicit state', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '左叶结节',
        location: '左叶',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        buildExam({ id: 'exam-2', exam_date: '2024-03-15', size_x: 8.3, tirads: '3' }),
        buildExam({ id: 'exam-1', exam_date: '2023-09-10', size_x: 7.8, tirads: '3' }),
      ],
    });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });

    render(<ComparePage />);

    expect(screen.getByText('记录不足，无法对比')).toBeTruthy();
    expect(screen.getByText('新增记录')).toBeTruthy();
  });

  it('supports latest-3, latest-5, and custom range windows', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '左叶结节',
        location: '左叶',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        buildExam({ id: 'e5', exam_date: '2024-03-15', tirads: '5', size_x: 8.3 }),
        buildExam({ id: 'e4', exam_date: '2023-09-10', tirads: '4', size_x: 7.8 }),
        buildExam({ id: 'e3', exam_date: '2023-03-05', tirads: '3', size_x: 7.1 }),
        buildExam({ id: 'e2', exam_date: '2022-09-01', tirads: '2', size_x: 6.8 }),
        buildExam({ id: 'e1', exam_date: '2022-03-01', tirads: '1', size_x: 6.2 }),
      ],
    });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });

    render(<ComparePage />);

    // Default latest-3 should NOT include the earliest "1级".
    expect(screen.queryByText('1级')).toBeNull();

    fireEvent.press(screen.getByText('最近5次'));
    expect(screen.getByText('1级')).toBeTruthy();

    fireEvent.press(screen.getByText('自定义'));
    const rangeInputs = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(rangeInputs[0]!, '2022-09-01');
    fireEvent.changeText(rangeInputs[1]!, '2023-09-10');
    fireEvent.press(screen.getByText('应用范围'));

    // Custom range excludes the latest "5级".
    expect(screen.queryByText('5级')).toBeNull();
    expect(screen.getByText('4级')).toBeTruthy();
  });

  it('formats quantitative deltas vs previous and baseline', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '左叶结节',
        location: '左叶',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        buildExam({ id: 'latest', exam_date: '2024-03-15', size_x: 8.3, size_y: 5.8, size_z: 6.1, tirads: '3' }),
        buildExam({ id: 'prev', exam_date: '2023-09-10', size_x: 7.8, size_y: 5.2, size_z: 5.8, tirads: '3' }),
        buildExam({ id: 'base', exam_date: '2023-03-05', size_x: 7.1, size_y: null, size_z: null, tirads: '3' }),
      ],
    });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });

    render(<ComparePage />);

    expect(screen.getByText('▲ +0.5mm (+6%)')).toBeTruthy();
    expect(screen.getByText('▲ +1.2mm (+17%)')).toBeTruthy();
  });

  it('adapts qualitative rows to disease type', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'lung',
        label: '右上叶结节',
        location: '右上叶',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        buildExam({ id: 'latest', exam_date: '2024-03-15', size_x: 8.3, lung_rads: '4a', density: '磨玻璃', morphology: '不规则', pleural_pull: 1 }),
        buildExam({ id: 'prev', exam_date: '2023-09-10', size_x: 7.8, lung_rads: '4a', density: '磨玻璃', morphology: '不规则', pleural_pull: 1 }),
        buildExam({ id: 'base', exam_date: '2023-03-05', size_x: 7.1, lung_rads: '3', density: '实性', morphology: '规则', pleural_pull: 0 }),
      ],
    });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });

    render(<ComparePage />);

    expect(screen.getByText('LUNG-RADS')).toBeTruthy();
    expect(screen.getByText('密度')).toBeTruthy();
    expect(screen.queryByText('TI-RADS')).toBeNull();
  });

  it('degrades AI summary cleanly when size deltas are sparse', () => {
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '左叶结节',
        location: '左叶',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        buildExam({ id: 'latest', exam_date: '2024-03-15', size_x: null, tirads: '3' }),
        buildExam({ id: 'prev', exam_date: '2023-09-10', size_x: null, tirads: '3' }),
        buildExam({ id: 'base', exam_date: '2023-03-05', size_x: null, tirads: '3' }),
      ],
    });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });

    render(<ComparePage />);

    expect(screen.getByText('数据不足，暂不生成变化小结。')).toBeTruthy();
  });

  it('validates and persists follow-up edits through reminder mutations', async () => {
    mockUpdateReminderMutateAsync.mockResolvedValue(undefined);
    mockDeactivateReminderMutateAsync.mockResolvedValue(undefined);
    mockUseLocalSearchParams.mockReturnValue({ id: 'lesion-1' });
    mockUseLesion.mockReturnValue({
      data: {
        id: 'lesion-1',
        profile_id: 'profile-1',
        disease_type: 'thyroid',
        label: '左叶结节',
        location: '左叶',
        is_archived: 0,
        created_at: '2026-04-13T00:00:00.000Z',
        updated_at: '2026-04-13T00:00:00.000Z',
      },
    });
    mockUseExaminations.mockReturnValue({
      data: [
        buildExam({ id: 'latest', exam_date: '2024-03-15', size_x: 8.3, tirads: '3' }),
        buildExam({ id: 'prev', exam_date: '2023-09-10', size_x: 7.8, tirads: '3' }),
        buildExam({ id: 'base', exam_date: '2023-03-05', size_x: 7.1, tirads: '3' }),
      ],
    });
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

    render(<ComparePage />);

    fireEvent.press(screen.getByText('修改'));

    fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), 'not-a-date');
    fireEvent.press(screen.getByText('保存'));
    expect(screen.getByText('请输入正确的日期（YYYY-MM-DD）')).toBeTruthy();
    expect(mockUpdateReminderMutateAsync).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2025-01-10');
    await act(async () => {
      fireEvent.press(screen.getByText('保存'));
      await Promise.resolve();
    });

    expect(mockUpdateReminderMutateAsync).toHaveBeenCalledWith({
      id: 'rem-1',
      updates: { next_exam_date: '2025-01-10', source: 'manual', is_active: 1 },
    });

    fireEvent.press(screen.getByText('修改'));
    await act(async () => {
      fireEvent.press(screen.getByText('清除设置'));
      await Promise.resolve();
    });
    expect(mockDeactivateReminderMutateAsync).toHaveBeenCalledWith('rem-1');
  });
});
