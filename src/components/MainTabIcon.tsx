import bold from 'expo-symbols/androidWeights/bold';
import regular from 'expo-symbols/androidWeights/regular';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export type MainTabIconVariant = 'home' | 'reminders' | 'settings';

type MainTabIconProps = {
  color: string;
  focused: boolean;
  variant: MainTabIconVariant;
};

const symbolNames = {
  home: {
    active: {
      ios: 'house.fill',
      android: 'home_filled',
      web: 'home_filled',
    },
    inactive: {
      ios: 'house',
      android: 'home',
      web: 'home',
    },
  },
  reminders: {
    active: {
      ios: 'bell.fill',
      android: 'notifications_active',
      web: 'notifications_active',
    },
    inactive: {
      ios: 'bell',
      android: 'notifications_none',
      web: 'notifications_none',
    },
  },
  settings: {
    active: {
      ios: 'gearshape.fill',
      android: 'settings',
      web: 'settings',
    },
    inactive: {
      ios: 'gearshape',
      android: 'settings',
      web: 'settings',
    },
  },
} as const;

export function MainTabIcon({ color, focused, variant }: MainTabIconProps) {
  const names = symbolNames[variant];

  return (
    <View
      testID={`main-tab-icon-${variant}`}
      style={[styles.container, focused ? styles.containerActive : styles.containerInactive]}>
      <SymbolView
        testID={`main-tab-icon-${variant}-symbol`}
        name={focused ? names.active : names.inactive}
        size={20}
        tintColor={color}
        weight={focused ? { ios: 'bold', android: bold } : { ios: 'regular', android: regular }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  containerActive: {
    backgroundColor: '#EFE7DA',
    borderColor: '#E6DED2',
  },
  containerInactive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
});
