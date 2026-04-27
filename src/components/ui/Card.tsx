import { View, type ViewProps } from '@/tw';

export function Card({ children, className, ...props }: ViewProps) {
  return (
    <View className={`rounded-[13px] border border-border bg-card p-3 ${className || ''}`} {...props}>
      {children}
    </View>
  );
}
