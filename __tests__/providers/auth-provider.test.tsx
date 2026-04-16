import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text, Pressable, View } from 'react-native';

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
const tokenStorage = require('@/lib/auth/token-storage') as {
  saveTokens: jest.Mock;
  clearTokens: jest.Mock;
  getAccessToken: jest.Mock;
  subscribeTokenChanges: jest.Mock;
};

function AuthConsumer() {
  const { signInWithSms, signOut, user, isLoading, isAuthenticated, isNewUser } = useAuth();

  return (
    <View>
      <Text testID="loading">{isLoading ? 'loading' : 'ready'}</Text>
      <Text testID="authenticated">{isAuthenticated ? 'yes' : 'no'}</Text>
      <Text testID="new-user">{isNewUser ? 'yes' : 'no'}</Text>
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

describe('AuthProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('bootstraps without a token and stays anonymous', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('ready');
    });

    expect(screen.getByTestId('authenticated').props.children).toBe('no');
    expect(screen.getByText('anonymous')).toBeTruthy();
  });

  it('signs in via SMS, saves tokens, and loads current user', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);
    api.post.mockResolvedValue({
      access_token: 'access_1',
      refresh_token: 'refresh_1',
      expires_in: 3600,
      is_new_user: true,
    });
    api.get.mockResolvedValue({
      id: 'u1',
      phone: '13800000000',
      nickname: 'Test',
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
      expect(tokenStorage.saveTokens).toHaveBeenCalledWith({
        accessToken: 'access_1',
        refreshToken: 'refresh_1',
        expiresIn: 3600,
      });
      expect(api.get).toHaveBeenCalledWith('/api/v1/auth/me');
      expect(screen.getByText('13800000000')).toBeTruthy();
      expect(screen.getByTestId('authenticated').props.children).toBe('yes');
      expect(screen.getByTestId('new-user').props.children).toBe('yes');
    });
  });

  it('fails closed when token issuance succeeds but bootstrap /me fails', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);
    api.post.mockResolvedValue({
      access_token: 'access_1',
      refresh_token: 'refresh_1',
      expires_in: 3600,
      is_new_user: true,
    });
    api.get.mockRejectedValue(new Error('bootstrap failed'));

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
      expect(tokenStorage.saveTokens).toHaveBeenCalledTimes(1);
      expect(tokenStorage.clearTokens).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('authenticated').props.children).toBe('no');
      expect(screen.getByTestId('new-user').props.children).toBe('no');
      expect(screen.getByText('anonymous')).toBeTruthy();
    });
  });

  it('signs out by clearing tokens and session state', async () => {
    tokenStorage.getAccessToken.mockResolvedValue(null);
    api.post.mockResolvedValue({
      access_token: 'access_1',
      refresh_token: 'refresh_1',
      expires_in: 3600,
      is_new_user: false,
    });
    api.get.mockResolvedValue({
      id: 'u1',
      phone: '13800000000',
      nickname: null,
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
      expect(screen.getByText('13800000000')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('sign-out'));

    await waitFor(() => {
      expect(tokenStorage.clearTokens).toHaveBeenCalledTimes(1);
      expect(screen.getByText('anonymous')).toBeTruthy();
      expect(screen.getByTestId('authenticated').props.children).toBe('no');
      expect(screen.getByTestId('new-user').props.children).toBe('no');
    });
  });

  it('throws when hook is used outside provider', () => {
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within AuthProvider');
  });
});
