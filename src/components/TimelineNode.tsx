import { View, Text } from 'react-native';

type TimelineNodeProps = {
  isLatest: boolean;
  date: string;
  interval?: string;
  children: React.ReactNode;
};

export function TimelineNode({ isLatest, date, interval, children }: TimelineNodeProps) {
  return (
    <View className="flex-row">
      <View className="items-center mr-4 w-6">
        <View className={`w-4 h-4 rounded-full border-2 border-primary ${isLatest ? 'bg-primary' : 'bg-white'}`} />
        <View className="flex-1 w-0.5 bg-neutral-bg" />
      </View>
      <View className="flex-1 pb-6">
        <Text className="text-xs text-neutral-text mb-1">{date}</Text>
        {children}
        {interval && (
          <Text className="text-xs text-neutral-text mt-2 italic">间隔 {interval}</Text>
        )}
      </View>
    </View>
  );
}
