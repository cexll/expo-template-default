import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { formatLocalMonth, readLocalSummaryExportUsed } from '@/lib/subscription/local-quota';

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

function pickNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

  // Derive remaining quota from used/limit fields when explicit remaining is absent.
  // This keeps the UI truthful across proto-shaped payloads and envelope-shaped payloads.
  for (const featureKey of ['ai_recognize', 'summary_export'] as const) {
    if (typeof featureRemaining[featureKey] === 'number') continue;

    const used =
      pickNumber(record[`${featureKey}_used`]) ??
      (featureKey === 'ai_recognize' ? pickNumber(record.aiRecognizeUsed) : pickNumber(record.summaryExportUsed)) ??
      null;
    const limit =
      pickNumber(record[`${featureKey}_limit`]) ??
      (featureKey === 'ai_recognize' ? pickNumber(record.aiRecognizeLimit) : pickNumber(record.summaryExportLimit)) ??
      null;

    if (used === null || limit === null) continue;
    if (limit < 0) continue;
    featureRemaining[featureKey] = Math.max(0, Math.floor(limit - used));
  }

  // Client-side quota shadow: summary export is an on-device action, so we must decrement the free cap
  // even when the backend status endpoint is mock-first and only exposes a quota snapshot.
  // To avoid double-counting when the backend later implements export consumption, we only apply the
  // local delta beyond the server-reported used count.
  const isActive = explicitActive ?? activeFromExpiry;
  if (!isActive) {
    const month = formatLocalMonth();

    const serverExportUsed =
      pickNumber(record.summary_export_used) ??
      (() => {
        const usage = record.usage;
        if (!usage || typeof usage !== 'object') return null;
        const summary = (usage as Record<string, unknown>).summary_export;
        if (!summary || typeof summary !== 'object') return null;
        return pickNumber((summary as Record<string, unknown>).used);
      })() ??
      0;

    const localUsed = readLocalSummaryExportUsed(month);
    const localDelta = Math.max(0, localUsed - serverExportUsed);

    const exportRemaining = featureRemaining.summary_export;
    if (typeof exportRemaining === 'number' && localDelta > 0) {
      featureRemaining.summary_export = Math.max(0, exportRemaining - localDelta);
    }
  }

  return {
    plan,
    isActive,
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
