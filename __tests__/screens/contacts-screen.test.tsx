import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ContactsScreen from '@/app/(tabs)/contacts';

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

describe('ContactsScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('navigates to entry detail from entrance and contact rows', () => {
    render(<ContactsScreen />);

    fireEvent.press(screen.getByText('新的朋友'));
    fireEvent.press(screen.getByText('Amy'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/entry/new-friends');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/entry/contact-amy');
  });
});
