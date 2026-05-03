import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { useProfiles } from '@/hooks/useProfiles';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { listExaminationsByLesion } from '@/lib/db/queries/examinations';
import { listLesionsByProfile } from '@/lib/db/queries/lesions';
import { listActiveRemindersByProfile } from '@/lib/db/queries/reminders';
import { buildHomeProjection } from '@/lib/home/projection';
import type { Examination, Lesion, Reminder } from '@/lib/db/types';

export function useHomeProjection(activeProfileId: string | null) {
  const { data: profiles = [] } = useProfiles();
  const { data: subscriptionStatus } = useSubscriptionStatus();

  const profileLesionResults = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: ['lesions', 'profile', profile.id],
      queryFn: () => listLesionsByProfile(profile.id),
      enabled: Boolean(profile.id),
    })),
  });

  const profileReminderResults = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: ['reminders', 'active', profile.id],
      queryFn: () => listActiveRemindersByProfile(profile.id),
      enabled: Boolean(profile.id),
    })),
  });

  const lesions = useMemo<Lesion[]>(
    () => profileLesionResults.flatMap((result) => result.data ?? []),
    [profileLesionResults]
  );

  const activeLesions = useMemo(
    () => lesions.filter((lesion) => lesion.is_archived === 0),
    [lesions]
  );

  const examinationResults = useQueries({
    queries: activeLesions.map((lesion) => ({
      queryKey: ['examinations', 'lesion', lesion.id],
      queryFn: () => listExaminationsByLesion(lesion.id),
      enabled: Boolean(lesion.id),
    })),
  });

  return useMemo(
    () => buildHomeProjection({
      profiles,
      activeProfileId,
      lesions,
      examinations: examinationResults.flatMap((result) => result.data ?? []) as Examination[],
      reminders: profileReminderResults.flatMap((result) => result.data ?? []) as Reminder[],
      entitlement: subscriptionStatus ?? null,
      now: new Date(),
    }),
    [activeProfileId, examinationResults, lesions, profileReminderResults, profiles, subscriptionStatus]
  );
}
