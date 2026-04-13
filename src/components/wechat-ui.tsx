import React from 'react';

import { Pressable, Text, View } from '@/tw';

type SectionProps = {
  children: React.ReactNode;
  title?: string;
};

export function Section({ children, title }: SectionProps) {
  return (
    <View className="mt-5">
      {title ? (
        <Text className="mb-2 px-1 text-xs font-medium uppercase tracking-[2px] text-ink-400">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-[28px] bg-white">{children}</View>
    </View>
  );
}

type BadgeProps = {
  kind?: 'count' | 'dot';
  value?: number;
};

function Badge({ kind = 'count', value }: BadgeProps) {
  if (kind === 'dot') {
    return <View className="h-2.5 w-2.5 rounded-full bg-[#e94f4f]" />;
  }

  if (!value) {
    return null;
  }

  return (
    <View className="min-w-6 rounded-full bg-[#e94f4f] px-2 py-0.5">
      <Text className="text-center text-xs font-semibold text-white">{value}</Text>
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  badgeCount?: number;
  showDot?: boolean;
  onPress?: () => void;
  leading?: string;
};

export function ListRow({
  title,
  subtitle,
  meta,
  badgeCount,
  showDot,
  onPress,
  leading,
}: ListRowProps) {
  const content = (
    <View className="flex-row items-center gap-3 border-b border-ink-100 px-4 py-4 last:border-b-0">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-100">
        <Text className="text-base font-semibold text-brand-700">{leading ?? title.slice(0, 1)}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-medium text-ink-900">{title}</Text>
        {subtitle ? <Text className="mt-1 text-sm text-ink-400">{subtitle}</Text> : null}
      </View>
      <View className="items-end gap-2">
        {meta ? <Text className="text-xs text-ink-400">{meta}</Text> : null}
        {showDot ? <Badge kind="dot" /> : null}
        {badgeCount ? <Badge value={badgeCount} /> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

type TabVisualProps = {
  badgeCount?: number;
  focused: boolean;
  label: string;
  showDot?: boolean;
};

export function TabVisual({ badgeCount, focused, label, showDot }: TabVisualProps) {
  return (
    <View className={`flex-1 rounded-2xl border px-3 py-2 ${focused ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'}`}>
      <View className="items-center">
        <View className="relative">
          <View className={`h-7 w-7 rounded-xl ${focused ? 'bg-brand-500' : 'bg-ink-100'}`} />
          {badgeCount ? (
            <View className="absolute -right-2 -top-2">
              <Badge value={badgeCount} />
            </View>
          ) : null}
          {showDot ? (
            <View className="absolute -right-1 -top-1">
              <Badge kind="dot" />
            </View>
          ) : null}
        </View>
        <Text className={`mt-2 text-xs font-medium ${focused ? 'text-brand-700' : 'text-ink-400'}`}>
          {label}
        </Text>
      </View>
    </View>
  );
}
