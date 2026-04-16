import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import UploadPage from '@/app/record/upload';
import RecognizePage from '@/app/record/recognize';
import MatchPage from '@/app/record/match';
import LesionDetailPage from '@/app/lesion/[id]';
import ComparePage from '@/app/lesion/[id]/compare';
import SummaryPage from '@/app/summary/[profileId]';
import { ChangeBadge } from '@/components/ChangeBadge';
import { ComparisonRow } from '@/components/ComparisonRow';
import { TimelineNode } from '@/components/TimelineNode';
import { ProgressBar } from '@/components/ui/ProgressBar';

const mockUseLocalSearchParams = jest.fn();
const mockUseLesion = jest.fn();
const mockUseLesions = jest.fn();
const mockUseExaminations = jest.fn();
const mockUseQuery = jest.fn();
const mockUseQueries = jest.fn();
const mockUseSubscriptionStatus = jest.fn();
const mockUseProfile = jest.fn();
const mockUseActiveReminders = jest.fn();
const mockUseRemindersByLesion = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockApiPost = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: any[]) => mockReadAsStringAsync(...args),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    code: number;
    status: number;

    constructor(message: string, code: number, status: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
    }
  },
  api: {
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (args: any) => mockUseQuery(args),
    useQueries: (args: any) => mockUseQueries(args),
    useQueryClient: () => ({
      invalidateQueries: jest.fn(),
      setQueryData: jest.fn(),
    }),
  };
});

jest.mock('@/hooks/useLesions', () => ({
  useLesion: (id: string) => mockUseLesion(id),
  useLesions: (...args: any[]) => mockUseLesions(...args),
}));

jest.mock('@/hooks/useExaminations', () => ({
  useExaminations: (lesionId: string) => mockUseExaminations(lesionId),
}));

jest.mock('@/hooks/useProfiles', () => ({
  useProfile: (...args: any[]) => mockUseProfile(...args),
}));

jest.mock('@/hooks/useReminders', () => ({
  useActiveReminders: (...args: any[]) => mockUseActiveReminders(...args),
  useRemindersByLesion: (...args: any[]) => mockUseRemindersByLesion(...args),
  useCreateReminder: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeactivateReminder: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateReminder: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: (...args: any[]) => mockUseSubscriptionStatus(...args),
  canUseFeature: () => true,
  subscriptionKeys: {
    status: (accountKey: string | null) => ['subscription', 'status', accountKey],
  },
}));

jest.mock('@/providers/active-profile-provider', () => ({
  useActiveProfile: () => ({
    activeProfileId: 'profile-1',
    setActiveProfileId: jest.fn(),
    bootstrapHomeDefaultProfile: jest.fn(),
  }),
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', phone: '13800000000' },
    signOut: jest.fn(),
  }),
}));

function collectClassNameProps(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null,
  path = 'root'
): string[] {
  if (node == null || typeof node === 'string') {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child, index) => collectClassNameProps(child, `${path}[${index}]`));
  }

  const currentPath = `${path}.${node.type}`;
  const currentNode = typeof node.props.className === 'string' ? [`${currentPath} -> ${node.props.className}`] : [];

  return currentNode.concat(
    (node.children ?? []).flatMap((child, index) => collectClassNameProps(child, `${currentPath}[${index}]`))
  );
}

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

function buildExam(overrides: Partial<any>) {
  return {
    id: overrides.id ?? 'exam',
    lesion_id: overrides.lesion_id ?? 'lesion-1',
    exam_date: overrides.exam_date ?? '2024-03-15',
    hospital: overrides.hospital ?? '北京协和医院',
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

describe('archive tracking style bridge regression guard', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({});
    mockUseLesion.mockReturnValue({ data: null, isFetched: true, isLoading: false });
    mockUseLesions.mockReturnValue({ data: [] });
    mockUseExaminations.mockReturnValue({ data: [] });
    mockUseQuery.mockReturnValue({ data: [] });
    mockUseQueries.mockReturnValue([]);
    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });
    mockUseProfile.mockReturnValue({ data: null, isLoading: false, isFetching: false });
    mockUseActiveReminders.mockReturnValue({ data: [] });
    mockUseRemindersByLesion.mockReturnValue({ data: [] });
    mockReadAsStringAsync.mockResolvedValue('BASE64_A');
    mockApiPost.mockResolvedValue({
      disease_type: 'thyroid',
      fields: {
        location: { value: '左叶中下段', confidence: 0.92 },
        size_x: { value: '8.3', confidence: 0.88 },
        tirads: { value: '3', confidence: 0.86 },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('bridges className styling for upload, recognize, and match record-flow surfaces', async () => {
    mockUseLocalSearchParams
      .mockReturnValueOnce({
        images: JSON.stringify([{ uri: 'file:///a.png', mimeType: 'image/png' }]),
        diseaseType: 'thyroid',
      })
      .mockReturnValueOnce({
        images: JSON.stringify([{ uri: 'file:///a.png', mimeType: 'image/png' }]),
        diseaseType: 'thyroid',
      })
      .mockReturnValueOnce({
        diseaseType: 'thyroid',
        images: JSON.stringify([{ uri: 'file:///a.png', mimeType: 'image/png' }]),
        recognizedData: JSON.stringify({
          location: '左叶中下段',
          size_x: '8.3',
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
          label: '甲状腺左叶结节',
          location: '左叶中下段',
          is_archived: 0,
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
        },
      ],
    });
    mockUseQueries.mockReturnValue([{ data: [{ size_x: 8.3 }] }]);

    const uploadTree = render(<UploadPage />).toJSON();
    expect(collectClassNameProps(uploadTree)).toEqual([]);

    const recognizeView = render(<RecognizePage />);
    await waitFor(() => {
      expect(recognizeView.getByText('AI识别核对')).toBeTruthy();
    });
    expect(collectClassNameProps(recognizeView.toJSON())).toEqual([]);

    const matchTree = render(<MatchPage />).toJSON();
    expect(collectClassNameProps(matchTree)).toEqual([]);
  });

  it('bridges className styling for lesion detail, compare, and summary surfaces', async () => {
    mockUseLocalSearchParams
      .mockReturnValueOnce({ id: 'lesion-1' })
      .mockReturnValueOnce({ id: 'lesion-1' })
      .mockReturnValueOnce({ profileId: 'profile-1' });

    const lesion = {
      id: 'lesion-1',
      profile_id: 'profile-1',
      disease_type: 'thyroid',
      label: '甲状腺左叶结节',
      location: '左叶中下段',
      is_archived: 0,
      created_at: '2026-04-13T00:00:00.000Z',
      updated_at: '2026-04-13T00:00:00.000Z',
    };

    mockUseLesion.mockReturnValue({ data: lesion, isFetched: true, isLoading: false });
    mockUseExaminations.mockReturnValue({
      data: [
        buildExam({ id: 'latest', exam_date: '2024-03-15', size_x: 8.3, size_y: 5.8, size_z: 6.1, tirads: '3' }),
        buildExam({ id: 'prev', exam_date: '2023-09-10', size_x: 7.8, size_y: 5.2, size_z: 5.8, tirads: '3' }),
        buildExam({ id: 'base', exam_date: '2023-03-05', size_x: 7.1, tirads: '3' }),
      ],
    });
    mockUseQuery.mockReturnValue({
      data: [{ id: 'report-1', examination_id: 'latest', uri: 'file:///report-1.png' }],
    });
    mockUseRemindersByLesion.mockReturnValue({
      data: [{ id: 'rem-1', lesion_id: 'lesion-1', next_exam_date: '2024-09-15', source: 'auto', is_active: 1 }],
    });

    mockUseProfile.mockReturnValue({
      data: { id: 'profile-1', nickname: '张女士', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
      isLoading: false,
      isFetching: false,
    });
    mockUseLesions.mockReturnValue({ data: [lesion] });
    mockUseActiveReminders.mockReturnValue({
      data: [{ id: 'rem-1', lesion_id: 'lesion-1', next_exam_date: '2024-09-15', source: 'auto', is_active: 1 }],
    });
    mockUseQueries.mockReturnValue([
      {
        data: [
          buildExam({ id: 'latest', exam_date: '2024-03-15', size_x: 8.3, size_y: 5.8, size_z: 6.1, tirads: '3', calcification: '点状强回声' }),
          buildExam({ id: 'prev', exam_date: '2023-09-10', size_x: 7.8, size_y: 5.2, size_z: 5.8, tirads: '3', calcification: '无' }),
          buildExam({ id: 'base', exam_date: '2023-03-05', size_x: 7.1, tirads: '3', calcification: '无' }),
        ],
      },
    ]);

    const detailTree = render(<LesionDetailPage />).toJSON();
    expect(collectClassNameProps(detailTree)).toEqual([]);

    const compareTree = render(<ComparePage />).toJSON();
    expect(collectClassNameProps(compareTree)).toEqual([]);

    const summaryTree = renderWithQueryClient(<SummaryPage />).toJSON();
    expect(collectClassNameProps(summaryTree)).toEqual([]);
  });

  it('bridges className styling for shared timeline, comparison, change-badge, and progress primitives', () => {
    const tree = render(
      <>
        <ChangeBadge type="increase" value="+1.2mm (+17%)" />
        <ComparisonRow
          label="TI-RADS"
          values={['3级', '3级', '3级']}
          changeType="unchanged"
          changeValue="未变"
          hasChanged={false}
        />
        <TimelineNode isLatest date="2024-03-15" interval="6个月">
          <ProgressBar progress={0.75} />
        </TimelineNode>
      </>
    ).toJSON();

    expect(collectClassNameProps(tree)).toEqual([]);
  });
});
