import type { SubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { normalizeSubscriptionAccountScope } from '@/lib/subscription/account-scope';

const PENDING_ORDER_PREFIX = 'noduleArchive:subscription:pending_order:';
const memoryStorage = new Map<string, string>();

type OrderBaselineSnapshot = {
  isActive: boolean;
  plan: string;
  expiresAt: string | null;
};

export type PendingSubscriptionOrderContext = {
  accountKey?: string | null;
  orderId: string;
  plan: string;
  provider: string;
  amount?: string | null;
  currency?: string | null;
  createdAt?: string;
  baseline: OrderBaselineSnapshot;
};

function storageKey(orderId: string, accountKey?: string | null) {
  return `${PENDING_ORDER_PREFIX}${normalizeSubscriptionAccountScope(accountKey)}:${orderId}`;
}

function canUseLocalStorage() {
  try {
    return typeof globalThis !== 'undefined' && typeof globalThis.localStorage?.getItem === 'function';
  } catch {
    return false;
  }
}

function readStorageValue(key: string) {
  if (canUseLocalStorage()) {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  return memoryStorage.get(key) ?? null;
}

function writeStorageValue(key: string, value: string) {
  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.setItem(key, value);
      return;
    } catch {
      // fall through to memory storage
    }
  }

  memoryStorage.set(key, value);
}

function removeStorageValue(key: string) {
  if (canUseLocalStorage()) {
    try {
      globalThis.localStorage.removeItem(key);
    } catch {
      // ignore localStorage cleanup failures
    }
  }

  memoryStorage.delete(key);
}

function normalizeBaselineSnapshot(baseline?: Partial<OrderBaselineSnapshot> | null): OrderBaselineSnapshot {
  return {
    isActive: Boolean(baseline?.isActive),
    plan: typeof baseline?.plan === 'string' && baseline.plan ? baseline.plan : 'free',
    expiresAt: typeof baseline?.expiresAt === 'string' && baseline.expiresAt ? baseline.expiresAt : null,
  };
}

function toMillis(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function savePendingSubscriptionOrderContext(context: PendingSubscriptionOrderContext) {
  const payload: PendingSubscriptionOrderContext = {
    ...context,
    createdAt: context.createdAt ?? new Date().toISOString(),
    baseline: normalizeBaselineSnapshot(context.baseline),
  };

  writeStorageValue(storageKey(payload.orderId, payload.accountKey), JSON.stringify(payload));
  return payload;
}

export function readPendingSubscriptionOrderContext(orderId: string, accountKey?: string | null) {
  if (!orderId) return null;

  const raw = readStorageValue(storageKey(orderId, accountKey));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingSubscriptionOrderContext;
    if (!parsed || typeof parsed !== 'object' || parsed.orderId !== orderId) return null;
    return {
      ...parsed,
      baseline: normalizeBaselineSnapshot(parsed.baseline),
    };
  } catch {
    return null;
  }
}

export function clearPendingSubscriptionOrderContext(orderId: string, accountKey?: string | null) {
  if (!orderId) return;
  removeStorageValue(storageKey(orderId, accountKey));
}

export function doesSubscriptionStatusConfirmOrder(
  status: SubscriptionStatus | null | undefined,
  context: PendingSubscriptionOrderContext | null | undefined
) {
  if (!status?.isActive || !context) return false;
  if (!context.orderId || !context.plan || !context.provider) return false;
  if (status.plan !== context.plan) return false;

  if (!context.baseline.isActive) return true;
  if (context.baseline.plan !== status.plan) return true;

  const currentExpiry = toMillis(status.expiresAt);
  const baselineExpiry = toMillis(context.baseline.expiresAt);

  if (currentExpiry === null) return false;
  if (baselineExpiry === null) return true;

  return currentExpiry > baselineExpiry;
}
