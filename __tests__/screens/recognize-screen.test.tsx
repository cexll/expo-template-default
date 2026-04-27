import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import RecognizePage from '@/app/record/recognize';

const mockUseSubscriptionStatus = jest.fn();
const mockUseLesion = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: any[]) => mockRouterBack(...args),
    canGoBack: (...args: any[]) => mockRouterCanGoBack(...args),
    push: jest.fn(),
    replace: (...args: any[]) => mockRouterReplace(...args),
  },
  useLocalSearchParams: jest.fn(),
}));

const mockReadAsStringAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: any[]) => mockReadAsStringAsync(...args),
  EncodingType: { Base64: 'base64' },
}));

const mockApiPost = jest.fn();

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

jest.mock('@/hooks/useSubscriptionStatus', () => ({
  useSubscriptionStatus: () => mockUseSubscriptionStatus(),
  canUseFeature: (status: any, feature: 'ai_recognize' | 'summary_export') => {
    if (!status) return true;
    if (status.isActive) return true;
    const remaining = status.featureRemaining?.[feature];
    if (typeof remaining === 'number') return remaining > 0;
    return true;
  },
}));

jest.mock('@/hooks/useLesions', () => ({
  useLesion: (id: string) => mockUseLesion(id),
}));

describe('RecognizePage', () => {
  beforeEach(() => {
    mockRouterCanGoBack.mockReturnValue(true);
    mockUseLesion.mockReturnValue({ data: null, isFetched: true, isLoading: false });
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps backend fields and enables next step', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png', 'file:///b.png']),
      diseaseType: 'thyroid',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_B');

    mockApiPost.mockResolvedValue({
      disease_type: 'thyroid',
      fields: {
        location: { value: '左叶中下段', confidence: 0.9 },
        size_x: { value: '8.3', confidence: 0.92 },
        tirads: { value: '3', confidence: 0.85 },
      },
    });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('AI识别核对')).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.getByLabelText('报告图片预览1')).toBeTruthy();
    expect(screen.getByLabelText('报告图片预览2')).toBeTruthy();

    expect(screen.getByText('左叶中下段')).toBeTruthy();
    expect(screen.getByText('8.3')).toBeTruthy();

    fireEvent.press(screen.getByText('下一步：匹配病灶'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/ai/recognize', {
      disease_type: 'thyroid',
      images: ['BASE64_A', 'BASE64_B'],
    });

    const arg = (router.push as jest.Mock).mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      pathname: '/record/match',
      params: {
        diseaseType: 'thyroid',
      },
    });

    expect(arg.params.images).toBe(JSON.stringify(['file:///a.png', 'file:///b.png']));

    const recognized = JSON.parse(arg.params.recognizedData);
    expect(recognized).toMatchObject({
      location: '左叶中下段',
      size_x: '8.3',
      tirads: '3',
    });
  });

  it('locks diseaseType to the originating lesion context when lesionId is provided', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      lesionId: 'lesion-1',
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'lung', // attempt to drift via route param
    });

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
      isFetched: true,
      isLoading: false,
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');
    mockApiPost.mockResolvedValue({
      disease_type: 'thyroid',
      fields: {
        location: { value: '左叶中下段', confidence: 0.9 },
        size_x: { value: '8.3', confidence: 0.92 },
        tirads: { value: '3', confidence: 0.85 },
      },
    });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('AI识别核对')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.press(screen.getByText('下一步：匹配病灶'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/ai/recognize', {
      disease_type: 'thyroid',
      images: ['BASE64_A'],
    });

    const arg = (router.push as jest.Mock).mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      pathname: '/record/match',
      params: {
        diseaseType: 'thyroid',
        lesionId: 'lesion-1',
      },
    });
  });

  it('delays lesion-scoped auto-run until canonical lesion context resolves and never sends a drifted route-param disease type first', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      lesionId: 'lesion-1',
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'lung', // attempt to drift via route param on cold cache
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    // Cold-cache: lesion query not yet fetched, so recognize must NOT auto-run.
    mockUseLesion.mockReturnValueOnce({ data: null, isFetched: false, isLoading: true });
    const { rerender } = render(<RecognizePage />);

    expect(screen.getByText('加载病灶信息...')).toBeTruthy();
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();

    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');
    mockApiPost.mockResolvedValueOnce({
      disease_type: 'thyroid',
      fields: {
        location: { value: '左叶中下段', confidence: 0.9 },
        size_x: { value: '8.3', confidence: 0.92 },
        tirads: { value: '3', confidence: 0.85 },
      },
    });

    // Lesion context resolves: now the FIRST AI request must use canonical lesion disease type.
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
      isFetched: true,
      isLoading: false,
    });
    rerender(<RecognizePage />);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/ai/recognize', {
      disease_type: 'thyroid',
      images: ['BASE64_A'],
    });
  });

  it('auto-runs recognition and shows loading state while processing', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'thyroid',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');

    let resolvePost: (value: any) => void;
    const pending = new Promise((resolve) => {
      resolvePost = resolve as any;
    });
    mockApiPost.mockReturnValueOnce(pending);

    render(<RecognizePage />);

    expect(screen.getByText('AI识别中...')).toBeTruthy();

    resolvePost!({
      disease_type: 'thyroid',
      fields: {
        location: { value: '左叶中下段', confidence: 0.9 },
        size_x: { value: '8.3', confidence: 0.92 },
        tirads: { value: '3', confidence: 0.85 },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('AI识别核对')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('surfaces OCR failure and blocks progression', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'thyroid',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');
    mockApiPost.mockRejectedValue(new Error('识别失败'));

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('识别失败')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.press(screen.getByText('下一步：匹配病灶'));

    expect(router.push).not.toHaveBeenCalled();
  });

  it('fails safely when images are missing', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify([]),
      diseaseType: 'thyroid',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('未收到可识别的图片')).toBeTruthy();
    }, { timeout: 5000 });

    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('blocks OCR backend call when quota is exhausted', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'thyroid',
    });

    mockUseSubscriptionStatus.mockReturnValue({
      data: { isActive: false, featureRemaining: { ai_recognize: 0 } },
      isLoading: false,
    });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('升级解锁')).toBeTruthy();
    }, { timeout: 5000 });

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('treats 403 quota errors as paywall-active and blocks manual progression', async () => {
    const { useLocalSearchParams, router } = require('expo-router');
    const { ApiError } = require('@/lib/api');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'lung',
    });

    // Status payload may be missing explicit remaining counts; backend 403 must still
    // force paywall gating and disable progression.
    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: false }, isLoading: false });

    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');
    mockApiPost.mockRejectedValue(new ApiError('ai recognize quota exceeded', 403, 403));

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('升级解锁')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.press(screen.getByText('先不了，继续免费版'));

    // Must still initialize the lung-specific field set.
    expect(screen.getByText(/^密度/)).toBeTruthy();
    expect(screen.getByText('磨玻璃')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('请输入部位'), '右上叶前段');
    fireEvent.changeText(screen.getByPlaceholderText('请输入大小(长)'), '6.2');
    fireEvent.press(screen.getByText('2'));
    fireEvent.press(screen.getByText('磨玻璃'));
    fireEvent.press(screen.getByText('下一步：匹配病灶'));

    expect(router.push).not.toHaveBeenCalled();
  });

  it('initializes disease fields but blocks Next/Match while AI quota paywall is active', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'lung',
    });

    mockUseSubscriptionStatus.mockReturnValue({
      data: { isActive: false, featureRemaining: { ai_recognize: 0 } },
      isLoading: false,
    });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('升级解锁')).toBeTruthy();
    }, { timeout: 5000 });

    // Close the modal so the underlying form is interactable.
    fireEvent.press(screen.getByText('先不了，继续免费版'));

    // Must still initialize the lung-specific field set.
    expect(screen.getByText(/^密度/)).toBeTruthy();
    expect(screen.getByText('磨玻璃')).toBeTruthy();

    // Even if all required fields are manually filled, quota exhaustion must block progression.
    fireEvent.changeText(screen.getByPlaceholderText('请输入部位'), '右上叶前段');
    fireEvent.changeText(screen.getByPlaceholderText('请输入大小(长)'), '6.2');
    fireEvent.press(screen.getByText('2'));
    fireEvent.press(screen.getByText('磨玻璃'));
    fireEvent.press(screen.getByText('下一步：匹配病灶'));

    expect(router.push).not.toHaveBeenCalled();
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('requires lung density before enabling next step', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'lung',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');

    mockApiPost.mockResolvedValue({
      disease_type: 'lung',
      fields: {
        location: { value: '右上叶前段', confidence: 0.91 },
        size_x: { value: '6.2', confidence: 0.9 },
        lung_rads: { value: '2', confidence: 0.88 },
      },
    });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('AI识别核对')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.press(screen.getByText('下一步：匹配病灶'));
    expect(router.push).not.toHaveBeenCalled();

    // Pending enum field still provides quick-pick chips.
    fireEvent.press(screen.getByText('磨玻璃'));
    fireEvent.press(screen.getByText('下一步：匹配病灶'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });
  });

  it('matches the demo OCR review hierarchy and expands enum quick-picks', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png', 'file:///b.png']),
      diseaseType: 'thyroid',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');
    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_B');
    mockApiPost.mockResolvedValue({
      disease_type: 'thyroid',
      fields: {
        disease_type: { value: '甲状腺', confidence: 0.95 },
        location: { value: '左叶中下段', confidence: 0.92 },
        tirads: { value: '3', confidence: 0.88 },
        echo_type: { value: '低回声', confidence: 0.86 },
        border: { value: '清晰', confidence: 0.85 },
      },
    });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('字段完整度')).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.getByText('超声报告')).toBeTruthy();
    expect(screen.getByText('共2张 · 2024-03-15')).toBeTruthy();
    expect(screen.getByText('已识别字段')).toBeTruthy();
    expect(screen.getByText('5/7 已确认')).toBeTruthy();
    expect(screen.getByText('结节类型')).toBeTruthy();
    expect(screen.getByText('甲状腺')).toBeTruthy();
    expect(screen.getByText('TI-RADS')).toBeTruthy();
    expect(screen.getByText('3级')).toBeTruthy();
    expect(screen.getByText('需要补填')).toBeTruthy();
    expect(screen.getByText('大小')).toBeTruthy();
    expect(screen.getAllByText('请补填').length).toBeGreaterThanOrEqual(2);

    fireEvent.press(screen.getByText('下一步：匹配病灶'));
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByText('展开')[0]);
    expect(screen.getByText('TI-RADS 分级')).toBeTruthy();
    expect(screen.getByText('4a级')).toBeTruthy();
    fireEvent.press(screen.getByText('4a级'));
    expect(screen.getByDisplayValue('4a级')).toBeTruthy();
  });

  it('renders prototype recognition seed without backend AI and carries match seed forward', async () => {
    const { useLocalSearchParams, router } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      prototypeRecognitionSeed: 'demo',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: null, isLoading: true });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('5/7 已确认')).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.getByText('超声报告')).toBeTruthy();
    expect(screen.getByText('共2张 · 2024-03-15')).toBeTruthy();
    expect(screen.getByText('左叶中下段')).toBeTruthy();
    expect(mockApiPost).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('请输入大小'), '8.3');
    fireEvent.changeText(screen.getByPlaceholderText('请输入钙化'), '无');
    fireEvent.press(screen.getByText('下一步：匹配病灶'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });

    const arg = (router.push as jest.Mock).mock.calls[0]?.[0];
    expect(arg.params.prototypeMatchSeed).toBe('demo');
  });

  it('progress counts only confirmed or high-confidence valid fields', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify(['file:///a.png']),
      diseaseType: 'lung',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: false });

    mockReadAsStringAsync.mockResolvedValueOnce('BASE64_A');

    mockApiPost.mockResolvedValue({
      disease_type: 'lung',
      fields: {
        location: { value: '右上叶前段', confidence: 0.91 },
        size_x: { value: '6.2', confidence: 0.9 },
        lung_rads: { value: '2', confidence: 0.88 },
        density: { value: '磨玻璃', confidence: 0.2 }, // low confidence should not auto-confirm
      },
    });

    render(<RecognizePage />);

    await waitFor(() => {
      expect(screen.getByText('3/10 已确认')).toBeTruthy();
    }, { timeout: 5000 });

    fireEvent.press(screen.getAllByText('磨玻璃').at(-1)!);

    await waitFor(() => {
      expect(screen.getByText('4/10 已确认')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('falls back to upload when there is no history', () => {
    const { useLocalSearchParams } = require('expo-router');

    mockRouterCanGoBack.mockReturnValue(false);
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      images: JSON.stringify([{ uri: 'file:///a.png', mimeType: 'image/png' }]),
      diseaseType: 'lung',
      lesionId: 'lesion-1',
    });

    mockUseSubscriptionStatus.mockReturnValue({ data: { isActive: true }, isLoading: true });
    mockUseLesion.mockReturnValue({ data: null, isFetched: false, isLoading: true });

    render(<RecognizePage />);

    fireEvent.press(screen.getByLabelText('返回上一层'));

    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/record/upload',
      params: {
        images: JSON.stringify([{ uri: 'file:///a.png', mimeType: 'image/png' }]),
        diseaseType: 'lung',
        lesionId: 'lesion-1',
      },
    });
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
