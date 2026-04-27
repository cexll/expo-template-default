import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { MainTabIcon } from '@/components/MainTabIcon';

jest.mock('expo-symbols', () => ({
  SymbolView: ({ name, tintColor, weight, testID }: any) => {
    const { Text } = require('react-native');

    return <Text testID={testID}>{JSON.stringify({ name, tintColor, weight })}</Text>;
  },
}));

jest.mock('expo-symbols/androidWeights/regular', () => ({
  __esModule: true,
  default: { name: 'regular-weight' },
}));

jest.mock('expo-symbols/androidWeights/bold', () => ({
  __esModule: true,
  default: { name: 'bold-weight' },
}));

describe('MainTabIcon', () => {
  it('renders destination-specific symbols for each main shell tab', () => {
    render(
      <>
        <MainTabIcon variant="home" color="#3D3528" focused />
        <MainTabIcon variant="reminders" color="#3D3528" focused />
        <MainTabIcon variant="settings" color="#3D3528" focused />
      </>
    );

    expect(screen.getByTestId('main-tab-icon-home-symbol').props.children).toContain('"ios":"house.fill"');
    expect(screen.getByTestId('main-tab-icon-home-symbol').props.children).toContain('"android":"home_filled"');

    expect(screen.getByTestId('main-tab-icon-reminders-symbol').props.children).toContain(
      '"ios":"bell.fill"'
    );
    expect(screen.getByTestId('main-tab-icon-reminders-symbol').props.children).toContain(
      '"android":"notifications_active"'
    );

    expect(screen.getByTestId('main-tab-icon-settings-symbol').props.children).toContain(
      '"ios":"gearshape.fill"'
    );
    expect(screen.getByTestId('main-tab-icon-settings-symbol').props.children).toContain(
      '"android":"settings"'
    );
  });

  it('uses distinct active and inactive visual states', () => {
    const { rerender } = render(<MainTabIcon variant="home" color="#C4BDB4" focused={false} />);

    expect(screen.getByTestId('main-tab-icon-home-symbol').props.children).toContain('"android":"home"');
    expect(screen.getByTestId('main-tab-icon-home-symbol').props.children).toContain(
      '"tintColor":"#C4BDB4"'
    );
    expect(StyleSheet.flatten(screen.getByTestId('main-tab-icon-home').props.style)).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    });

    rerender(<MainTabIcon variant="home" color="#3D3528" focused />);

    expect(screen.getByTestId('main-tab-icon-home-symbol').props.children).toContain(
      '"android":"home_filled"'
    );
    expect(screen.getByTestId('main-tab-icon-home-symbol').props.children).toContain(
      '"tintColor":"#3D3528"'
    );
    expect(StyleSheet.flatten(screen.getByTestId('main-tab-icon-home').props.style)).toMatchObject({
      backgroundColor: '#F5F0E6',
      borderColor: '#DDD8CF',
    });
  });
});
