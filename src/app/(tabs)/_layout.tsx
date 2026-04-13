import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

const ACTIVE = '#4f7a57';
const INACTIVE = '#8e8675';
const BG = '#ffffff';
const BORDER = '#ebe8de';

function TabIcon({ color }: { color: string }) {
  return <View style={[styles.icon, { backgroundColor: color }]} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#f7f6f2' },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '微信',
          tabBarBadge: 3,
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: '通讯录',
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '发现',
          tabBarBadge: '',
          tabBarBadgeStyle: styles.dotBadge,
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '我',
          tabBarIcon: ({ color }) => <TabIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dotBadge: {
    minWidth: 8,
    height: 8,
    maxWidth: 8,
    borderRadius: 999,
    backgroundColor: '#e94f4f',
    top: 10,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 8,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
    paddingTop: 6,
    backgroundColor: BG,
    borderTopColor: BORDER,
  },
});
