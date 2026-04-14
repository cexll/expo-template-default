import { View } from 'react-native';

type ProgressBarProps = {
  progress: number; // 0-1
  color?: string;
};

export function ProgressBar({ progress, color = 'bg-primary' }: ProgressBarProps) {
  const width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  return (
    <View className="h-2 rounded-full bg-neutral-bg overflow-hidden">
      <View className={`h-full rounded-full ${color}`} style={{ width: width as any }} />
    </View>
  );
}
