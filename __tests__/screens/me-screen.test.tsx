import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import MeScreen from '@/app/(tabs)/me';
import { trackEvent } from '@/lib/telemetry/client';
import { useAuth } from '@/providers/auth-provider';

const mockPush = jest.fn();
const mockSignInDemo = jest.fn();
const mockSignOut = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 56,
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/lib/telemetry/client', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const trackEventMock = jest.mocked(trackEvent);
const useAuthMock = jest.mocked(useAuth);

describe('MeScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('signs in and sends sign-in telemetry', async () => {
    useAuthMock.mockReturnValue({
      signInDemo: mockSignInDemo,
      signOut: mockSignOut,
      user: null,
    });
    trackEventMock.mockResolvedValue(undefined);

    render(<MeScreen />);

    expect(screen.getByText('当前未登录')).toBeTruthy();

    fireEvent.press(screen.getByText('Demo 登录'));

    await waitFor(() => {
      expect(mockSignInDemo).toHaveBeenCalledTimes(1);
      expect(trackEventMock).toHaveBeenCalledWith({ event: 'auth_sign_in_demo' });
    });
  });

  it('signs out and sends sign-out telemetry when user exists', async () => {
    useAuthMock.mockReturnValue({
      signInDemo: mockSignInDemo,
      signOut: mockSignOut,
      user: {
        id: 'demo-user',
        name: 'Chen Wenjie',
        role: 'demo',
      },
    });
    trackEventMock.mockResolvedValue(undefined);

    render(<MeScreen />);

    expect(screen.getByText('当前会话：Chen Wenjie')).toBeTruthy();

    fireEvent.press(screen.getByText('退出'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(trackEventMock).toHaveBeenCalledWith({ event: 'auth_sign_out_demo' });
    });
  });

  it('navigates to settings from profile card and service row', () => {
    useAuthMock.mockReturnValue({
      signInDemo: mockSignInDemo,
      signOut: mockSignOut,
      user: null,
    });

    render(<MeScreen />);

    fireEvent.press(screen.getByText('Chen Wenjie'));
    fireEvent.press(screen.getByText('设置'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/entry/settings');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/entry/settings');
  });
});
