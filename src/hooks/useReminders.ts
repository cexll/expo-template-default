import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createReminder,
  deactivateReminder,
  listActiveRemindersByProfile,
  listRemindersByLesion,
  syncBackendRemindersToLocal,
  updateReminder,
  type CreateReminderInput,
  type UpdateReminderInput,
} from '@/lib/db/queries/reminders';

const reminderKeys = {
  all: ['reminders'] as const,
  activeByProfile: (profileId: string) => ['reminders', 'active', profileId] as const,
  byLesion: (lesionId: string) => ['reminders', 'lesion', lesionId] as const,
};

export function useActiveReminders(profileId: string) {
  return useQuery({
    queryKey: reminderKeys.activeByProfile(profileId),
    queryFn: async () => {
      try {
        await syncBackendRemindersToLocal(profileId);
      } catch {
        // Local reminders remain authoritative when backend sync is unavailable.
      }
      return listActiveRemindersByProfile(profileId);
    },
    enabled: Boolean(profileId),
  });
}

export function useRemindersByLesion(lesionId: string) {
  return useQuery({
    queryKey: reminderKeys.byLesion(lesionId),
    queryFn: () => listRemindersByLesion(lesionId),
    enabled: Boolean(lesionId),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReminderInput) => createReminder(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateReminderInput }) =>
      updateReminder(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}

export function useDeactivateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateReminder(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}
