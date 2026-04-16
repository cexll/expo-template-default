import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform, Pressable, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/providers/auth-provider';

jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
  },
  clearWebCookieSession: jest.fn(),
  AuthError: class AuthError extends Error {},
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
}));

jest.mock('@/lib/auth/token-storage', () => ({
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  getAccessToken: jest.fn(),
  subscribeTokenChanges: jest.fn(() => () => {}),
}));

const { api } = require('@/lib/api') as {
  api: { get: jest.Mock; post: jest.Mock };
};
const clearWebCookieSession = require('@/lib/api').clearWebCookieSession as jest.Mock;
const tokenStorage = require('@/lib/auth/token-storage') as {
  saveTokens: jest.Mock;
  clearTokens: jest.Mock;
  getAccessToken: jest.Mock;
  subscribeTokenChanges: jest.Mock;
};

function AuthConsumer() {
  const { signInWithSms, signOut, user, isLoading, isAuthenticated } = useAuth();

  return (
    <View>
      <Text testID="loading">{isLoading ? 'loading' : 'ready'}</Text>
      <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
      <Text testID="auth-user">{user ? user.phone : 'anonymous'}</Text>

      <Pressable
        testID="sign-in"
        onPress={() => {
          void signInWithSms('13800000000', '123456').catch(() => {});
        }}
      >
        <Text>sign in</Text>
      </Pressable>
      <Pressable testID="sign-out" onPress={() => void signOut()}>
        <Text>sign out</Text>
      </Pressable>
    </View>
  );
}

describe('AuthProvider web cookie session', () => {
  const originalPlatformOS = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('bootstraps from /auth/me on web even without a stored token', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);
    api.get.mockResolvedValue({
      id: 'u1',
      phone: '13800000000',
      nickname: 'Cookie User',
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('ready');
      expect(api.get).toHaveBeenCalledWith('/api/v1/auth/me');
      expect(screen.getByTestId('authenticated').props.children).toBe('yes');
      expect(screen.getByText('13800000000')).toBeTruthy();
    });
  });

  it('does not persist sms-issued tokens on web before bootstrapping current user', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);
    api.get
      .mockRejectedValueOnce(new Error('unauthenticated'))
      .mockResolvedValueOnce({
        id: 'u1',
        phone: '13800000000',
        nickname: 'Cookie User',
      });
    api.post.mockResolvedValue({
      access_token: 'access_1',
      refresh_token: 'refresh_1',
      expires_in: 3600,
      is_new_user: false,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('ready');
    });

    fireEvent.press(screen.getByTestId('sign-in'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/sms/verify', { phone: '13800000000', code: '123456' });
      expect(tokenStorage.saveTokens).not.toHaveBeenCalled();
      expect(api.get).toHaveBeenLastCalledWith('/api/v1/auth/me');
      expect(screen.getByTestId('authenticated').props.children).toBe('yes');
      expect(screen.getByText('13800000000')).toBeTruthy();
    });
  });

  it('clears the cookie session when post-login /auth/me bootstrap fails on web', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);
    api.get.mockRejectedValueOnce(new Error('unauthenticated'));
    api.post.mockResolvedValue({
      access_token: 'access_1',
      refresh_token: 'refresh_1',
      expires_in: 3600,
      is_new_user: false,
    });
    api.get.mockRejectedValueOnce(new Error('bootstrap failed'));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('ready');
    });

    fireEvent.press(screen.getByTestId('sign-in'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/sms/verify', { phone: '13800000000', code: '123456' });
      expect(clearWebCookieSession).toHaveBeenCalledTimes(2);
      expect(tokenStorage.clearTokens).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('authenticated').props.children).toBe('no');
      expect(screen.getByText('anonymous')).toBeTruthy();
    });
  });

  it('posts logout on web before clearing local auth state', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);
    api.get.mockResolvedValue({
      id: 'u1',
      phone: '13800000000',
      nickname: 'Cookie User',
    });
    api.post.mockResolvedValue({});

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('13800000000')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('sign-out'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/logout');
      expect(tokenStorage.clearTokens).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('authenticated').props.children).toBe('no');
      expect(screen.getByText('anonymous')).toBeTruthy();
    });
  });
});
