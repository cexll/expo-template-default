import { Modal, Platform } from 'react-native';
import { router } from 'expo-router';
import { Button } from './ui/Button';
import { PAYWALL_MEMBER_FEATURES } from '@/lib/subscription/catalog';
import { Pressable, Text, View } from '@/tw';

export type PaywallSheetProps = {
  visible: boolean;
  onClose: () => void;
  feature: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  reviewSeed?: string;
};

function FeatureRow({ text }: { text: string }) {
  return (
    <View className="flex-row items-center">
      <View className="mr-3 h-2 w-2 rounded-full bg-primary/25" />
      <Text className="flex-1 text-sm text-primary">{text}</Text>
    </View>
  );
}

export function PaywallSheet({ visible, onClose, feature, title, subtitle, ctaLabel, reviewSeed }: PaywallSheetProps) {
  const resolvedKicker = '升级解锁';
  const resolvedHeadline =
    title ??
    (feature === 'AI识别'
      ? 'AI识别次数已用完'
      : feature === '就诊摘要导出'
        ? '本月导出次数已用完'
        : '升级会员');
  const resolvedSubtitle =
    subtitle ??
    (feature === 'AI识别'
      ? '本月免费额度已用尽（5次/月）\n升级会员，享受无限次AI识别'
      : `本月${feature}免费额度已用尽\n升级会员后可无限使用`);
  const resolvedCta = ctaLabel ?? (feature === 'AI识别' ? '立即升级 · ¥399/年' : '查看会员方案');

  if (Platform.OS === 'web' && visible) {
    return (
      <div className="paywall-overlay show" id="paywall">
        <div className="paywall-sheet">
          <button className="paywall-close" onClick={onClose}>×</button>
          <div className="paywall-icon">✦</div>
          <div className="paywall-title">{resolvedHeadline}</div>
          <div className="paywall-sub">本月免费额度已用尽（5次/月）<br />升级会员，享受无限次AI识别</div>
          <div className="paywall-features">
            {PAYWALL_MEMBER_FEATURES.map((item) => (
              <div className="pf-row" key={item}><div className="pf-dot" /><span className="pf-text">{item}</span></div>
            ))}
          </div>
          <div className="paywall-price">
            <span className="pw-price-lbl">年度会员</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="pw-price-val">¥399 / 年</span>
              <span className="pw-price-save">省17%</span>
            </div>
          </div>
          <button
            className="paywall-cta"
            onClick={() => {
              onClose();
              router.push(reviewSeed ? `/subscription?${reviewSeed}` : '/subscription');
            }}
          >
            {resolvedCta}
          </button>
          <button className="paywall-later" onClick={onClose}>先不了，继续免费版</button>
        </div>
      </div>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="flex-1 bg-black/30" onPress={onClose} />
        <View className="rounded-t-3xl bg-card px-6 pb-10 pt-6">
          <Pressable
            className="absolute right-4 top-4 h-9 w-9 items-center justify-center rounded-full bg-nav-bg"
            onPress={onClose}
          >
            <Text className="text-lg font-semibold text-neutral-text">×</Text>
          </Pressable>

          <View className="items-center">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Text className="text-xl font-semibold text-primary">✦</Text>
            </View>
            <Text className="mt-4 text-xs font-semibold text-neutral-text">{resolvedKicker}</Text>
            <Text className="mt-2 text-xl font-bold text-primary">{resolvedHeadline}</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-neutral-text">
              {resolvedSubtitle}
            </Text>
          </View>

          <View className="mt-6 gap-3">
            {PAYWALL_MEMBER_FEATURES.map((item) => (
              <FeatureRow key={item} text={item} />
            ))}
          </View>

          <View className="mt-6 flex-row items-center justify-between rounded-2xl border border-ink-100 bg-nav-bg px-4 py-4">
            <Text className="text-sm font-semibold text-primary">年度会员</Text>
            <View className="flex-row items-center">
              <Text className="text-sm font-semibold text-primary">¥399 / 年</Text>
              <View className="ml-2 rounded-full bg-stable-bg px-2 py-0.5">
                <Text className="text-xs font-semibold text-stable-text">省17%</Text>
              </View>
            </View>
          </View>

          <View className="mt-6">
            <Button
              title={resolvedCta}
              fullWidth
              onPress={() => {
                onClose();
                router.push(reviewSeed ? `/subscription?${reviewSeed}` : '/subscription');
              }}
            />
          </View>

          <Pressable onPress={onClose} className="mt-4 items-center">
            <Text className="text-sm text-neutral-text">先不了，继续免费版</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
