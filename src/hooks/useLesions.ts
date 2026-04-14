import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createLesion,
  getLesionById,
  listLesionsByProfile,
  updateLesion,
  type CreateLesionInput,
  type UpdateLesionInput,
} from '@/lib/db/queries/lesions';

const lesionKeys = {
  all: ['lesions'] as const,
  byProfile: (profileId: string) => ['lesions', 'profile', profileId] as const,
  detail: (id: string) => ['lesions', id] as const,
};

export function useLesions(profileId: string) {
  return useQuery({
    queryKey: lesionKeys.byProfile(profileId),
    queryFn: () => listLesionsByProfile(profileId),
    enabled: Boolean(profileId),
  });
}

export function useLesion(id: string) {
  return useQuery({
    queryKey: lesionKeys.detail(id),
    queryFn: () => getLesionById(id),
    enabled: Boolean(id),
  });
}

export function useCreateLesion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLesionInput) => createLesion(input),
    onSuccess: async (lesion) => {
      await queryClient.invalidateQueries({ queryKey: lesionKeys.all });
      if (lesion) {
        queryClient.setQueryData(lesionKeys.detail(lesion.id), lesion);
      }
    },
  });
}

export function useUpdateLesion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateLesionInput }) =>
      updateLesion(id, updates),
    onSuccess: async (lesion, variables) => {
      await queryClient.invalidateQueries({ queryKey: lesionKeys.all });
      if (lesion) {
        queryClient.setQueryData(lesionKeys.detail(variables.id), lesion);
      }
    },
  });
}
