import type { SubscriptionStatus } from '@/hooks/useSubscriptionStatus';

export type FreeArchiveCounts = {
  profiles?: number;
  lesionsForProfile?: number;
  recordsForLesion?: number;
};

const DEFAULT_FREE_LIMITS = {
  profiles: 3,
  lesionsPerProfile: 5,
  recordsPerLesion: 10,
};

function limitValue(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function assertFreeArchiveLimit(
  status: Pick<SubscriptionStatus, 'isActive' | 'freeLimits'> | null | undefined,
  counts: FreeArchiveCounts
) {
  if (status?.isActive) return;

  const profileLimit = limitValue(status?.freeLimits?.profiles, DEFAULT_FREE_LIMITS.profiles);
  if (typeof counts.profiles === 'number' && counts.profiles >= profileLimit) {
    throw new Error(`免费版最多可创建${profileLimit}个档案人，升级后可无限管理家人档案`);
  }

  const lesionLimit = limitValue(status?.freeLimits?.lesionsPerProfile, DEFAULT_FREE_LIMITS.lesionsPerProfile);
  if (typeof counts.lesionsForProfile === 'number' && counts.lesionsForProfile >= lesionLimit) {
    throw new Error(`免费版每个档案人最多可管理${lesionLimit}个病灶，升级后可继续新增`);
  }

  const recordLimit = limitValue(status?.freeLimits?.recordsPerLesion, DEFAULT_FREE_LIMITS.recordsPerLesion);
  if (typeof counts.recordsForLesion === 'number' && counts.recordsForLesion >= recordLimit) {
    throw new Error(`免费版每个病灶最多可保存${recordLimit}次检查记录，升级后可继续记录`);
  }
}
