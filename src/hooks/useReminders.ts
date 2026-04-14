import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createReminder,
  deactivateReminder,
  listActiveRemindersByProfile,
  type CreateReminderInput,
} from '@/lib/db/queries/reminders';

const reminderKeys = {
  all: ['reminders'] as const,
  activeByProfile: (profileId: string) => ['reminders', 'active', profileId] as const,
};

export function useActiveReminders(profileId: string) {
  return useQuery({
    queryKey: reminderKeys.activeByProfile(profileId),
    queryFn: () => listActiveRemindersByProfile(profileId),
    enabled: Boolean(profileId),
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

export function useDeactivateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateReminder(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}
