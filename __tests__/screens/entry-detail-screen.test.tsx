import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import EntryDetailScreen from '@/app/entry/[slug]';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({
    back: mockBack,
  }),
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

describe('EntryDetailScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders mapped entry content for a known slug', () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'settings' });

    render(<EntryDetailScreen />);

    expect(screen.getByText('我')).toBeTruthy();
    expect(screen.getByText('设置')).toBeTruthy();
    expect(screen.getByText('账号、通知与通用')).toBeTruthy();
  });

  it('renders fallback content for an unknown slug and goes back', () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'unknown-slug' });

    render(<EntryDetailScreen />);

    expect(screen.getByText('未定义')).toBeTruthy();
    expect(screen.getByText('未找到页面')).toBeTruthy();
    expect(screen.getByText('这个占位页还没有绑定到具体入口。')).toBeTruthy();

    fireEvent.press(screen.getByText('返回'));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
