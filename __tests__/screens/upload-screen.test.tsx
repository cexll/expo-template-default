import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import UploadPage from '@/app/record/upload';

const mockRouterPush = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    push: (...args: any[]) => mockRouterPush(...args),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
  launchCameraAsync: jest.fn(),
}));

describe('UploadPage', () => {
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

    expect(JSON.parse(arg.params.images)).toEqual(['file:///a.png']);
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
    expect(JSON.parse(arg.params.images)).toEqual(['file:///b.png', 'file:///a.png']);
  });
});
