import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import OnboardingPage from '@/app/(auth)/onboarding';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

const mockUseAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseProfiles = jest.fn();
const mockMutateAsync = jest.fn();

jest.mock('@/hooks/useProfiles', () => ({
  useProfiles: () => mockUseProfiles(),
  useCreateProfile: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('OnboardingPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('matches the demo onboarding form defaults and live archive preview', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: true });
    mockUseProfiles.mockReturnValue({ data: [] });

    render(<OnboardingPage />);

    const flattenedTopStyle = StyleSheet.flatten(screen.getByTestId('onboarding-top').props.style);
    const flattenedSegmentStyle = StyleSheet.flatten(screen.getByTestId('onboarding-gender-segment').props.style);
    const flattenedPrimaryStyle = StyleSheet.flatten(screen.getByTestId('onboarding-submit-btn').props.style);

    expect(flattenedTopStyle).toMatchObject({ backgroundColor: '#F5F0E6', paddingTop: 20, paddingBottom: 16 });
    expect(flattenedSegmentStyle).toMatchObject({ backgroundColor: '#FFFFFF', borderRadius: 9, overflow: 'hidden' });
    expect(flattenedPrimaryStyle).toMatchObject({ backgroundColor: '#3D3528', borderRadius: 9 });

    expect(screen.getByText('创建第一个档案')).toBeTruthy();
    expect(screen.getByText('为自己或家人建立健康档案，开始管理结节数据')).toBeTruthy();
    expect(screen.getByText('昵称')).toBeTruthy();
    expect(screen.getByPlaceholderText('如：本人、妈妈、爸爸')).toBeTruthy();
    expect(screen.getByDisplayValue('本人')).toBeTruthy();
    expect(screen.getByText('性别')).toBeTruthy();
    expect(screen.getByText('女')).toBeTruthy();
    expect(screen.getByText('男')).toBeTruthy();
    expect(screen.getByText('出生年份')).toBeTruthy();
    expect(screen.getByDisplayValue('1985')).toBeTruthy();
    expect(screen.getByText('年')).toBeTruthy();
    expect(screen.getByText('档案预览')).toBeTruthy();
    expect(screen.getByText('创建档案，开始使用')).toBeTruthy();
    expect(screen.getByText('跳过，稍后再设置')).toBeTruthy();

    const currentYear = new Date().getFullYear();
    const initialAge = currentYear - 1985;
    expect(screen.getByText(`（${initialAge}岁）`)).toBeTruthy();
    expect(screen.getByText(`女 · 1985年 · ${initialAge}岁`)).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('如：本人、妈妈、爸爸'), '妈妈');
    fireEvent.press(screen.getByText('男'));
    fireEvent.changeText(screen.getByDisplayValue('1985'), '1978');

    const expectedAge = currentYear - 1978;

    await waitFor(() => {
      expect(screen.getByText('妈')).toBeTruthy();
      expect(screen.getByText('妈妈')).toBeTruthy();
      expect(screen.getByText(`男 · 1978年 · ${expectedAge}岁`)).toBeTruthy();
      expect(screen.getByText(`（${expectedAge}岁）`)).toBeTruthy();
    });
  });

  it('blocks profile creation when signed out', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [] });

    render(<OnboardingPage />);

    fireEvent.changeText(screen.getByPlaceholderText('如：本人、妈妈、爸爸'), '本人');
    fireEvent.press(screen.getByText('男'));
    fireEvent.changeText(screen.getByDisplayValue('1985'), '1985');

    fireEvent.press(screen.getByText('创建档案，开始使用'));

    await waitFor(() => {
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    const { router } = require('expo-router');
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('creates a profile with sort_order = existing count and navigates to /(main)', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: true });
    mockUseProfiles.mockReturnValue({
      data: [
        { id: 'profile-1', nickname: 'A', gender: 'female', birth_year: 1990, avatar_uri: null, sort_order: 0 },
        { id: 'profile-2', nickname: 'B', gender: 'male', birth_year: 1991, avatar_uri: null, sort_order: 1 },
      ],
    });

    mockMutateAsync.mockResolvedValue({
      id: 'profile-new',
      nickname: '本人',
      gender: 'male',
      birth_year: 1985,
      avatar_uri: null,
      sort_order: 2,
    });

    render(<OnboardingPage />);

    fireEvent.changeText(screen.getByPlaceholderText('如：本人、妈妈、爸爸'), ' 本人 ');
    fireEvent.press(screen.getByText('男'));
    fireEvent.changeText(screen.getByDisplayValue('1985'), '1985');

    fireEvent.press(screen.getByText('创建档案，开始使用'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    const input = mockMutateAsync.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      nickname: '本人',
      gender: 'male',
      birth_year: 1985,
      avatar_uri: null,
      sort_order: 2,
    });
    expect(typeof input.id).toBe('string');
    expect(input.id).toMatch(/^profile_/);

    const { router } = require('expo-router');
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/(main)');
    });
  });
});
