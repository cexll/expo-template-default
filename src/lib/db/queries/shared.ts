export function buildUpdateSet<T extends Record<string, unknown>>(updates: Partial<T>) {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return null;
  }

  return {
    clause: entries.map(([key]) => `${key} = ?`).join(', '),
    values: entries.map(([, value]) => value),
  };
}
