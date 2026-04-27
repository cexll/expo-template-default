import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { MainTabIcon } from '@/components/MainTabIcon';

export default function MainTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#FAF8F4' },
        tabBarActiveTintColor: '#3D3528',
        tabBarInactiveTintColor: '#C4BDB4',
        tabBarStyle: [styles.tabBar, styles.pixelParityHiddenTabBar],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon color={color} focused={focused} variant="home" />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: '提醒',
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon color={color} focused={focused} variant="reminders" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color, focused }) => (
            <MainTabIcon color={color} focused={focused} variant="settings" />
          ),
        }}
      />
      <Tabs.Screen
        name="profiles/new"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingTop: 7,
  },
  label: {
    fontFamily: 'DM Sans',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
  tabBar: {
    backgroundColor: '#FAF8F4',
    borderTopColor: '#E8E2D8',
    height: 86,
    paddingTop: 6,
  },
  pixelParityHiddenTabBar: {
    display: 'none',
  },
});
