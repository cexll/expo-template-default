import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

function TabIcon({ color }: { color: string }) {
  return <View style={[styles.icon, { backgroundColor: color }]} />;
}

export default function MainTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#FAF8F4' },
        tabBarActiveTintColor: '#3D3528',
        tabBarInactiveTintColor: '#C4BDB4',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: '提醒',
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
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
  icon: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  item: {
    paddingTop: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  tabBar: {
    backgroundColor: '#FAF8F4',
    borderTopColor: '#E6DED2',
    height: 86,
    paddingTop: 6,
  },
});
