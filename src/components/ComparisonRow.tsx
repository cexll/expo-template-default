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
  const normalizedValues = values.length > 0 ? values : ['—'];
  return (
    <View className={`flex-row items-center py-3 px-4 ${hasChanged ? 'bg-increase-bg/30' : ''}`}>
      <Text className="w-20 text-xs text-neutral-text">{label}</Text>
      <View className="flex-1 flex-row flex-wrap items-center">
        {normalizedValues.map((v, i) => {
          const isLatest = i === normalizedValues.length - 1;
          return (
            <View key={`${label}-${i}`} className="flex-row items-center">
              <Text
                className={`text-sm font-mono ${isLatest ? 'text-primary font-semibold' : 'text-neutral-text'}`}
              >
                {v}
              </Text>
              {i < normalizedValues.length - 1 ? (
                <Text className="mx-1 text-xs text-neutral-text">→</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {changeType ? <ChangeBadge type={changeType} value={changeValue} /> : null}
    </View>
  );
}
