import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, View } from '@/tw';

export default function SummaryIndexPage() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f6f2' }}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg text-neutral-text">档案 ID 无效</Text>
      </View>
    </SafeAreaView>
  );
}
