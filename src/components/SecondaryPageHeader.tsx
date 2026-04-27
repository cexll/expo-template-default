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
    <View className={`flex-row items-center justify-between border-b border-border-strong bg-nav-bg px-[18px] pb-[10px] pt-[13px] ${className ?? ''}`}>
      <View className="flex-1 items-start">
        <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={handleBack}>
          <Text className="text-xs font-normal text-muted">← {backLabel}</Text>
        </Pressable>
      </View>

      <Text className="px-3 font-serif text-sm font-normal text-primary">{title}</Text>

      <View className="flex-1 items-end">{rightSlot ?? <View className="min-w-[72px]" />}</View>
    </View>
  );
}
