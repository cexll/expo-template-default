import { Pressable, Text, View } from '@/tw';
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
    <View>
      <Text className={`text-xs font-medium text-[#2a2318] ${monospace ? 'font-mono' : ''}`}>
        {value}
      </Text>
      <Text className="mt-px text-[10px] text-hint">{label}</Text>
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
  const reminderColor = reminderTone === 'urgent' ? 'text-new-mid' : 'text-[#7a7060]';
  return (
    <Pressable onPress={onPress}>
      <Card className="mb-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[13px] font-medium text-[#2a2318]">{title}</Text>
            <Text className="mt-0.5 text-[10px] text-hint">{subtitle}</Text>
          </View>
          {statusBadge ? <Badge text={statusBadge.text} variant={statusBadge.variant} /> : null}
        </View>

        <View className="mt-2 flex-row gap-[14px]">
          <View className="flex-1"><Metric label="当前大小" value={latestSize} monospace /></View>
          <View className="flex-1"><Metric label="分级" value={radsGrade} /></View>
          <View className="flex-1"><Metric label="较基线" value={baselineChange} monospace /></View>
        </View>

        <View className="mt-2 flex-row items-center justify-between border-t border-[#f0ece6] pt-[7px]">
          <Text className="text-[10px] text-hint">
            {recordCount === null ? '—次记录' : `${recordCount}次记录`}
          </Text>
          <Text className={`text-[10px] font-medium ${reminderColor}`}>{reminderText}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
