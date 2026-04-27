import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LoginPage from '@/app/(auth)/login';
import { api } from '@/lib/api';

const mockSignInWithSms = jest.fn();
const mockSignInWithWechat = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
  },
}));

jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    signInWithSms: (...args: any[]) => mockSignInWithSms(...args),
    signInWithWechat: (...args: any[]) => mockSignInWithWechat(...args),
  }),
}));

describe('Login Page', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('matches the demo login hierarchy and disabled SMS form state', () => {
    render(<LoginPage />);

    const flattenedSafeAreaStyle = StyleSheet.flatten(screen.getByTestId('login-safe-area').props.style);
    const flattenedHeroStyle = StyleSheet.flatten(screen.getByTestId('login-hero').props.style);
    const flattenedPhoneButtonStyle = StyleSheet.flatten(screen.getByTestId('login-phone-btn').props.style);
    const flattenedWechatButtonStyle = StyleSheet.flatten(screen.getByTestId('login-wechat-btn').props.style);

    expect(flattenedSafeAreaStyle).toMatchObject({ backgroundColor: '#FAF8F4' });
    expect(flattenedHeroStyle).toMatchObject({ backgroundColor: '#F5F0E6', paddingTop: 52, paddingBottom: 36 });
    expect(flattenedPhoneButtonStyle).toEqual(expect.objectContaining({ backgroundColor: '#3D3528', borderRadius: 10 }));
    expect(flattenedWechatButtonStyle).toMatchObject({ backgroundColor: '#07C160', borderRadius: 10 });

    expect(screen.getByText('结节档案')).toBeTruthy();
    expect(screen.getByText('个人与家庭结节健康管理')).toBeTruthy();
    expect(screen.getByText('甲状腺 · 乳腺 · 肺结节')).toBeTruthy();
    expect(screen.getByText('手机号')).toBeTruthy();
    expect(screen.getByPlaceholderText('请输入手机号')).toBeTruthy();
    expect(screen.getByText('验证码')).toBeTruthy();
    expect(screen.getByPlaceholderText('6位验证码')).toBeTruthy();
    expect(screen.getByText('获取验证码')).toBeTruthy();
    expect(screen.getByText('登录 / 注册')).toBeTruthy();
    expect(screen.getByText('或')).toBeTruthy();
    expect(screen.getByText('微信一键登录')).toBeTruthy();
    expect(screen.getByText('医疗数据仅存储于本设备，不上传服务器')).toBeTruthy();

    expect(screen.getByTestId('login-code-group').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ opacity: 0.4 })]));
    expect(screen.getByTestId('login-phone-btn').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('enables SMS affordances after a valid phone and verifies a six digit code', async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    mockSignInWithSms.mockResolvedValue(undefined);

    render(<LoginPage />);

    fireEvent.changeText(screen.getByPlaceholderText('请输入手机号'), '13800000000');

    expect(screen.getByTestId('login-code-group').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ opacity: 1 })]));
    expect(screen.getByTestId('login-code-btn').props.accessibilityState).toMatchObject({ disabled: false });

    fireEvent.press(screen.getByText('获取验证码'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/sms/send', { phone: '13800000000' });
    });

    fireEvent.changeText(screen.getByPlaceholderText('6位验证码'), '123456');
    fireEvent.press(screen.getByText('登录 / 注册'));

    await waitFor(() => {
      expect(mockSignInWithSms).toHaveBeenCalledWith('13800000000', '123456');
    });
  });
});
