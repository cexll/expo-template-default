import { Text, View } from '@/tw';

type ChangeType = 'increase' | 'decrease' | 'unchanged' | 'new';

type ChangeBadgeProps = {
  type: ChangeType;
  value?: string;
};

export function ChangeBadge({ type, value }: ChangeBadgeProps) {
  switch (type) {
    case 'increase':
      return (
        <View className="flex-row items-center rounded-full bg-increase-bg px-3 py-1">
          <Text className="text-xs font-medium text-increase-text">▲ {value || ''}</Text>
        </View>
      );
    case 'decrease':
      return (
        <View className="flex-row items-center rounded-full bg-stable-bg px-3 py-1">
          <Text className="text-xs font-medium text-stable-text">▼ {value || ''}</Text>
        </View>
      );
    case 'unchanged':
      return (
        <View className="flex-row items-center rounded-full bg-neutral-bg px-3 py-1">
          <Text className="text-xs font-medium text-neutral-text">— 未变</Text>
        </View>
      );
    case 'new':
      return (
        <View className="flex-row items-center rounded-full bg-new-bg px-3 py-1">
          <Text className="text-xs font-medium text-new-text">新出现</Text>
        </View>
      );
  }
}
