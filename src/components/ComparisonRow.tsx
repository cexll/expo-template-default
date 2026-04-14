import { View, Text } from 'react-native';
import { ChangeBadge } from './ChangeBadge';

type ComparisonRowProps = {
  label: string;
  values: string[];
  changeType?: 'increase' | 'decrease' | 'unchanged' | 'new';
  changeValue?: string;
  hasChanged?: boolean;
};

export function ComparisonRow({ label, values, changeType, changeValue, hasChanged }: ComparisonRowProps) {
  return (
    <View className={`flex-row items-center py-3 px-4 ${hasChanged ? 'bg-increase-bg/30' : ''}`}>
      <Text className="w-20 text-xs text-neutral-text">{label}</Text>
      <View className="flex-1 flex-row justify-around">
        {values.map((v, i) => (
          <Text key={i} className="text-sm font-mono text-primary">{v}</Text>
        ))}
      </View>
      {changeType && <ChangeBadge type={changeType} value={changeValue} />}
    </View>
  );
}
