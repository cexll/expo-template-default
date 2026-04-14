import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createProfile,
  deleteProfile,
  getProfileById,
  listProfiles,
  updateProfile,
  type CreateProfileInput,
  type UpdateProfileInput,
} from '@/lib/db/queries/profiles';

const profileKeys = {
  all: ['profiles'] as const,
  detail: (id: string) => ['profiles', id] as const,
};

export function useProfiles(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: profileKeys.all,
    queryFn: listProfiles,
    enabled: options?.enabled ?? true,
  });
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: () => getProfileById(id),
    enabled: Boolean(id),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProfileInput) => createProfile(input),
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      if (profile) {
        queryClient.setQueryData(profileKeys.detail(profile.id), profile);
      }
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateProfileInput }) =>
      updateProfile(id, updates),
    onSuccess: async (profile, variables) => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      if (profile) {
        queryClient.setQueryData(profileKeys.detail(variables.id), profile);
      }
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      queryClient.removeQueries({ queryKey: profileKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: ['lesions'] });
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}
