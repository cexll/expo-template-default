import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LoginPage from '@/app/(auth)/login';

const mockSignInWithWechat = jest.fn();

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    signInWithSms: jest.fn(),
    signInWithWechat: (...args: any[]) => mockSignInWithWechat(...args),
  }),
}));

describe('WeChat login wiring', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('submits the pasted code via signInWithWechat', async () => {
    mockSignInWithWechat.mockResolvedValue(undefined);

    render(<LoginPage />);

    fireEvent.press(screen.getByText('微信一键登录'));

    fireEvent.changeText(screen.getByPlaceholderText('请输入 code'), 'wx_code_123');
    fireEvent.press(screen.getByText('确认登录'));

    await waitFor(() => {
      expect(mockSignInWithWechat).toHaveBeenCalledWith('wx_code_123');
    });
  });

  it('shows a visible error when code is empty', async () => {
    render(<LoginPage />);

    fireEvent.press(screen.getByText('微信一键登录'));
    fireEvent.press(screen.getByText('确认登录'));

    await waitFor(() => {
      expect(screen.getByText('请输入微信登录 code')).toBeTruthy();
    });
  });
});
