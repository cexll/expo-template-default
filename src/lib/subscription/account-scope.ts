const DEFAULT_ACCOUNT_SCOPE = 'anonymous';

export function normalizeSubscriptionAccountScope(accountKey?: string | null) {
  if (typeof accountKey !== 'string') return DEFAULT_ACCOUNT_SCOPE;

  const trimmed = accountKey.trim();
  if (!trimmed) return DEFAULT_ACCOUNT_SCOPE;

  return encodeURIComponent(trimmed);
}
