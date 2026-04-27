import { Text, View } from '@/tw';

type BadgeVariant = 'increase' | 'new' | 'stable' | 'neutral';

type BadgeProps = {
  text: string;
  variant?: BadgeVariant;
};

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  increase: { bg: 'bg-increase-bg', text: 'text-increase-text' },
  new: { bg: 'bg-blue-bg', text: 'text-blue-text' },
  stable: { bg: 'bg-stable-bg', text: 'text-stable-text' },
  neutral: { bg: 'bg-neutral-bg', text: 'text-neutral-text' },
};

export function Badge({ text, variant = 'neutral' }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <View className={`rounded-[14px] px-[7px] py-0.5 ${styles.bg}`}>
      <Text className={`text-[10px] font-medium leading-none ${styles.text}`}>{text}</Text>
    </View>
  );
}
