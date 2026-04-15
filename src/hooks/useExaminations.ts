import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createExamination,
  listExaminationsByLesion,
  listLatestExaminationsByProfile,
  type CreateExaminationInput,
} from '@/lib/db/queries/examinations';

const examinationKeys = {
  all: ['examinations'] as const,
  byLesion: (lesionId: string) => ['examinations', 'lesion', lesionId] as const,
  latestByProfile: (profileId: string) => ['examinations', 'latest', profileId] as const,
};

export function useExaminations(lesionId: string) {
  return useQuery({
    queryKey: examinationKeys.byLesion(lesionId),
    queryFn: () => listExaminationsByLesion(lesionId),
    enabled: Boolean(lesionId),
  });
}

export function useLatestExaminationsByProfile(profileId: string) {
  return useQuery({
    queryKey: examinationKeys.latestByProfile(profileId),
    queryFn: () => listLatestExaminationsByProfile(profileId),
    enabled: Boolean(profileId),
  });
}

export function useCreateExamination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExaminationInput) => createExamination(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: examinationKeys.all });
    },
  });
}
