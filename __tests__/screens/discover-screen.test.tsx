import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import DiscoverScreen from '@/app/(tabs)/discover';

const mockPush = jest.fn();

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

describe('DiscoverScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('navigates to entry detail from discover rows', () => {
    render(<DiscoverScreen />);

    fireEvent.press(screen.getByText('朋友圈'));
    fireEvent.press(screen.getByText('扫一扫'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/entry/moments');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/entry/scan');
  });
});
