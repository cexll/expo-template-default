import { Text, View } from '@/tw';

type BadgeVariant = 'increase' | 'new' | 'stable' | 'neutral';

type BadgeProps = {
  text: string;
  variant?: BadgeVariant;
};

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  increase: { bg: 'bg-increase-bg', text: 'text-increase-text' },
  new: { bg: 'bg-new-bg', text: 'text-new-text' },
  stable: { bg: 'bg-stable-bg', text: 'text-stable-text' },
  neutral: { bg: 'bg-neutral-bg', text: 'text-neutral-text' },
};

export function Badge({ text, variant = 'neutral' }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <View className={`rounded-full px-3 py-1 ${styles.bg}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{text}</Text>
    </View>
  );
}
