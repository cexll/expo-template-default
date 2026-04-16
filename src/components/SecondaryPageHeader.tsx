import type { ReactNode } from 'react';
import { router, type Href } from 'expo-router';

import { Pressable, Text, View } from '@/tw';

type SecondaryPageHeaderProps = {
  title: string;
  fallbackHref: Href;
  rightSlot?: ReactNode;
  className?: string;
  backLabel?: string;
  accessibilityLabel?: string;
};

export function SecondaryPageHeader({
  title,
  fallbackHref,
  rightSlot,
  className,
  backLabel = '返回',
  accessibilityLabel = '返回上一层',
}: SecondaryPageHeaderProps) {
  const handleBack = () => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  };

  return (
    <View className={`mt-4 flex-row items-center ${className ?? ''}`}>
      <View className="flex-1 items-start">
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          className="rounded-full border border-neutral-bg bg-card px-3 py-2"
          onPress={handleBack}
        >
          <Text className="text-sm font-semibold text-primary">← {backLabel}</Text>
        </Pressable>
      </View>

      <Text className="px-3 text-sm font-semibold text-primary">{title}</Text>

      <View className="flex-1 items-end">{rightSlot ?? <View className="min-w-[72px]" />}</View>
    </View>
  );
}
