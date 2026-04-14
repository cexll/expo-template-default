import React from 'react';
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

  it('shows a live archive preview that updates as the user edits fields', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, isNewUser: true });
    mockUseProfiles.mockReturnValue({ data: [] });

    render(<OnboardingPage />);

    // Preview block should be visible.
    expect(screen.getByText('档案预览')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('例如：本人、妈妈'), '本人');
    fireEvent.press(screen.getByText('男'));
    fireEvent.changeText(screen.getByPlaceholderText('例如：1985'), '1985');

    const currentYear = new Date().getFullYear();
    const expectedAge = currentYear - 1985;

    await waitFor(() => {
      expect(screen.getByText('本人')).toBeTruthy();
      expect(screen.getByText(`男 · 1985年 · ${expectedAge}岁`)).toBeTruthy();
    });
  });

  it('blocks profile creation when signed out', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, isNewUser: false });
    mockUseProfiles.mockReturnValue({ data: [] });

    render(<OnboardingPage />);

    fireEvent.changeText(screen.getByPlaceholderText('例如：本人、妈妈'), '本人');
    fireEvent.press(screen.getByText('男'));
    fireEvent.changeText(screen.getByPlaceholderText('例如：1985'), '1985');

    fireEvent.press(screen.getByText('开始使用'));

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

    fireEvent.changeText(screen.getByPlaceholderText('例如：本人、妈妈'), ' 本人 ');
    fireEvent.press(screen.getByText('男'));
    fireEvent.changeText(screen.getByPlaceholderText('例如：1985'), '1985');

    fireEvent.press(screen.getByText('开始使用'));

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
