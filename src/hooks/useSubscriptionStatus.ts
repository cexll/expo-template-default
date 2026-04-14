import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export type SubscriptionPlan = 'free' | 'monthly' | 'yearly' | string;

export type SubscriptionStatus = {
  plan: SubscriptionPlan;
  isActive: boolean;
  expiresAt: string | null;
  featureRemaining?: Record<string, number>;
};

const subscriptionKeys = {
  status: () => ['subscription', 'status'] as const,
};

function pickString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function pickBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

export function normalizeSubscriptionStatus(raw: unknown): SubscriptionStatus {
  if (!raw || typeof raw !== 'object') {
    return { plan: 'free', isActive: false, expiresAt: null };
  }

  const record = raw as Record<string, unknown>;
  const plan = pickString(record.plan) ?? pickString(record.current_plan) ?? pickString(record.tier) ?? 'free';

  const expiresAt =
    pickString(record.expires_at) ??
    pickString(record.expiresAt) ??
    pickString(record.expires_at_iso) ??
    null;

  const explicitActive =
    pickBoolean(record.is_active) ?? pickBoolean(record.active) ?? pickBoolean(record.is_premium) ?? null;

  const activeFromExpiry = (() => {
    if (!expiresAt) return false;
    const millis = Date.parse(expiresAt);
    if (!Number.isFinite(millis)) return false;
    return millis > Date.now();
  })();

  const featureRemaining: Record<string, number> = {};
  const tryReadRemaining = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const tryReadQuotaRemaining = (value: unknown) => {
    if (!value || typeof value !== 'object') return null;
    const q = value as Record<string, unknown>;
    const used = typeof q.used === 'number' && Number.isFinite(q.used) ? q.used : null;
    const limit = typeof q.limit === 'number' && Number.isFinite(q.limit) ? q.limit : null;
    if (used === null || limit === null) return null;
    return Math.max(0, limit - used);
  };

  const features = record.features;
  if (features && typeof features === 'object') {
    for (const [key, value] of Object.entries(features as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const remaining = tryReadRemaining((value as Record<string, unknown>).remaining);
      if (remaining !== null) featureRemaining[key] = remaining;
    }
  }

  const remainingMap = record.remaining;
  if (remainingMap && typeof remainingMap === 'object') {
    for (const [key, value] of Object.entries(remainingMap as Record<string, unknown>)) {
      const remaining = tryReadRemaining(value);
      if (remaining !== null) featureRemaining[key] = remaining;
    }
  }

  for (const quotaKey of ['quotas', 'quota', 'usage']) {
    const quotaMap = record[quotaKey];
    if (!quotaMap || typeof quotaMap !== 'object') continue;
    for (const [key, value] of Object.entries(quotaMap as Record<string, unknown>)) {
      const remaining = tryReadQuotaRemaining(value);
      if (remaining !== null) featureRemaining[key] = remaining;
    }
  }

  for (const featureKey of ['ai_recognize', 'summary_export']) {
    const remaining = tryReadRemaining(record[`${featureKey}_remaining`]);
    if (remaining !== null) featureRemaining[featureKey] = remaining;
  }

  return {
    plan,
    isActive: explicitActive ?? activeFromExpiry,
    expiresAt,
    featureRemaining: Object.keys(featureRemaining).length > 0 ? featureRemaining : undefined,
  };
}

export function formatSubscriptionPlan(plan: SubscriptionPlan) {
  if (plan === 'yearly') return '年度会员';
  if (plan === 'monthly') return '月度会员';
  if (plan === 'free') return '免费版';
  return plan;
}

export type SubscriptionFeatureKey = 'ai_recognize' | 'summary_export' | (string & {});

export function canUseFeature(status: SubscriptionStatus, feature: SubscriptionFeatureKey) {
  if (status.isActive) return true;
  const remaining = status.featureRemaining?.[feature];
  if (typeof remaining === 'number') return remaining > 0;
  return true;
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: subscriptionKeys.status(),
    queryFn: async () => api.get<unknown>('/api/v1/subscription/status'),
    select: normalizeSubscriptionStatus,
    retry: 1,
    staleTime: 15_000,
  });
}
