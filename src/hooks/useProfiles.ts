import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createBackendProfile,
  createProfile,
  deleteProfile,
  getProfileById,
  listProfiles,
  updateProfile,
  type BackendProfileInput,
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

function useProfileMutation<TInput>(mutationFn: (input: TInput) => ReturnType<typeof createProfile>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      if (profile) {
        queryClient.setQueryData(profileKeys.detail(profile.id), profile);
      }
    },
  });
}

export function useCreateProfile() {
  return useProfileMutation((input: CreateProfileInput) => createProfile(input));
}

export function useCreateBackendProfile() {
  return useProfileMutation((input: BackendProfileInput) => createBackendProfile(input));
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
