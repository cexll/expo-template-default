import { View, Text, Pressable } from 'react-native';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

type LesionCardProps = {
  title: string;
  subtitle: string;
  statusBadge?: { text: string; variant: 'increase' | 'new' | 'stable' | 'neutral' };
  latestSize: string;
  radsGrade: string;
  baselineChange: string;
  recordCount: number | null;
  reminderText: string;
  reminderTone?: 'urgent' | 'normal';
  onPress?: () => void;
};

function Metric({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-neutral-text">{label}</Text>
      <Text className={`mt-1 text-sm font-semibold text-primary ${monospace ? 'font-mono' : ''}`}>
        {value}
      </Text>
    </View>
  );
}

export function LesionCard({
  title,
  subtitle,
  statusBadge,
  latestSize,
  radsGrade,
  baselineChange,
  recordCount,
  reminderText,
  reminderTone = 'normal',
  onPress,
}: LesionCardProps) {
  const reminderColor = reminderTone === 'urgent' ? 'text-new-text' : 'text-neutral-text';
  return (
    <Pressable onPress={onPress}>
      <Card className="mb-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-primary">{title}</Text>
            <Text className="mt-1 text-xs text-neutral-text">{subtitle}</Text>
          </View>
          {statusBadge ? <Badge text={statusBadge.text} variant={statusBadge.variant} /> : null}
        </View>

        <View className="mt-3 flex-row gap-4">
          <Metric label="当前大小" value={latestSize} monospace />
          <Metric label="分级" value={radsGrade} />
          <Metric label="较基线" value={baselineChange} monospace />
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs text-neutral-text">
            {recordCount === null ? '—次记录' : `${recordCount}次记录`}
          </Text>
          <Text className={`text-xs font-medium ${reminderColor}`}>{reminderText}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
