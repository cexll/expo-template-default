import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import RecognizePage from '@/app/record/recognize';

const mockUseSubscriptionStatus = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
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

describe('RecognizePage', () => {
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
    });

    expect(screen.getByDisplayValue('左叶中下段')).toBeTruthy();
    expect(screen.getByDisplayValue('8.3')).toBeTruthy();

    fireEvent.press(screen.getByText('下一步 — 匹配病灶'));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    });

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

    const recognized = JSON.parse(arg.params.recognizedData);
    expect(recognized).toMatchObject({
      location: '左叶中下段',
      size_x: '8.3',
      tirads: '3',
    });
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
    });

    fireEvent.press(screen.getByText('下一步 — 匹配病灶'));

    expect(router.push).not.toHaveBeenCalled();
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
    });

    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
