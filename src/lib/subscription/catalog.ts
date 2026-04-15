export const SUBSCRIPTION_COMPARISON_ROWS = [
  { name: 'AI识别次数', free: '5次/月', paid: '无限' },
  { name: '就诊摘要导出', free: '2次/月', paid: '无限' },
  { name: '云端同步备份', free: '不支持', paid: '会员支持（开发中）' },
] as const;

export const PREMIUM_UNLOCKED_RIGHTS = [
  { label: 'AI识别次数', value: '无限次', tone: 'positive' as const },
  { label: '就诊摘要导出', value: '无限次', tone: 'positive' as const },
  { label: '云端同步备份', value: '会员支持（开发中）', tone: 'neutral' as const },
] as const;

export const PAYWALL_MEMBER_FEATURES = PREMIUM_UNLOCKED_RIGHTS.map((item) => `${item.label}${item.value ? ` · ${item.value}` : ''}`);

function pickAmountValue(amount: number | string | null | undefined) {
  if (typeof amount === 'number' && Number.isFinite(amount)) return amount;
  if (typeof amount !== 'string') return null;

  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPaymentAmount(amount: number | string | null | undefined, currency?: string | null) {
  const numericAmount = pickAmountValue(amount);
  if (numericAmount === null) return null;

  const normalizedCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!normalizedCurrency || normalizedCurrency === 'CNY' || normalizedCurrency === 'RMB') {
    return `¥${numericAmount.toFixed(2)}`;
  }

  return `${normalizedCurrency} ${numericAmount.toFixed(2)}`;
}
