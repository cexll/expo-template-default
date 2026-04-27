import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import UploadPage from '@/app/record/upload';

const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockUseLesion = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: any[]) => mockRouterBack(...args),
    canGoBack: (...args: any[]) => mockRouterCanGoBack(...args),
    push: (...args: any[]) => mockRouterPush(...args),
    replace: (...args: any[]) => mockRouterReplace(...args),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
  launchCameraAsync: jest.fn(),
}));

jest.mock('@/hooks/useLesions', () => ({
  useLesion: (id: string) => mockUseLesion(id),
}));

describe('UploadPage', () => {
  beforeEach(() => {
    mockRouterCanGoBack.mockReturnValue(true);
    mockUseLesion.mockReturnValue({ data: null });
    const { useLocalSearchParams } = require('expo-router');
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('blocks recognition until an image and disease are selected', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.png' }],
    });

    render(<UploadPage />);

    fireEvent.press(screen.getByText('开始识别'));
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('相册'));

    await waitFor(() => {
      expect(screen.getByLabelText('删除图片1')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('开始识别'));
    expect(mockRouterPush).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('甲状腺'));
    fireEvent.press(screen.getByText('开始识别'));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const arg = mockRouterPush.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      pathname: '/record/recognize',
      params: {
        diseaseType: 'thyroid',
      },
    });

    expect(JSON.parse(arg.params.images)).toEqual([{ uri: 'file:///a.png', mimeType: null }]);
  });

  it('locks disease type when entered from a lesion (lesionId)', async () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      lesionId: 'lesion-1',
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
    });

    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.png' }],
    });

    render(<UploadPage />);

    fireEvent.press(screen.getByText('相册'));

    await waitFor(() => {
      expect(screen.getByLabelText('删除图片1')).toBeTruthy();
    });

    // Attempt to switch disease; should be ignored when lesion-scoped.
    fireEvent.press(screen.getByText('肺'));
    fireEvent.press(screen.getByText('开始识别'));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const arg = mockRouterPush.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      pathname: '/record/recognize',
      params: {
        diseaseType: 'thyroid',
        lesionId: 'lesion-1',
      },
    });
  });

  it('supports preview reorder and preserves order into recognition', async () => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///a.png' }, { uri: 'file:///b.png' }],
    });

    render(<UploadPage />);

    fireEvent.press(screen.getByText('相册'));

    await waitFor(() => {
      expect(screen.getByLabelText('删除图片2')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('下移图片1'));
    fireEvent.press(screen.getByText('肺'));
    fireEvent.press(screen.getByText('开始识别'));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    const arg = mockRouterPush.mock.calls[0]?.[0];
    expect(arg.params.diseaseType).toBe('lung');
    expect(JSON.parse(arg.params.images)).toEqual([
      { uri: 'file:///b.png', mimeType: null },
      { uri: 'file:///a.png', mimeType: null },
    ]);
  });

  it('renders deterministic prototype images and carries the review seed to recognition', () => {
    const { useLocalSearchParams } = require('expo-router');

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      prototypeRecognitionSeed: 'demo',
    });

    render(<UploadPage />);

    expect(screen.getByLabelText('删除图片1')).toBeTruthy();
    expect(screen.getByLabelText('删除图片2')).toBeTruthy();

    fireEvent.press(screen.getByText('开始识别'));

    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush.mock.calls[0]?.[0]).toMatchObject({
      pathname: '/record/recognize',
      params: {
        diseaseType: 'thyroid',
        prototypeRecognitionSeed: 'demo',
      },
    });
  });

  it('shows a back affordance and falls back to home when opened without history', () => {
    mockRouterCanGoBack.mockReturnValue(false);

    render(<UploadPage />);

    fireEvent.press(screen.getByLabelText('返回上一层'));

    expect(mockRouterReplace).toHaveBeenCalledWith('/(main)');
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
