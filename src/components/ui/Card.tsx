import { View, type ViewProps } from '@/tw';

export function Card({ children, className, ...props }: ViewProps) {
  return (
    <View className={`bg-card rounded-2xl p-4 shadow-sm ${className || ''}`} {...props}>
      {children}
    </View>
  );
}
