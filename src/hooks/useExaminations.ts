import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createExamination,
  listExaminationsByLesion,
  type CreateExaminationInput,
} from '@/lib/db/queries/examinations';

const examinationKeys = {
  all: ['examinations'] as const,
  byLesion: (lesionId: string) => ['examinations', 'lesion', lesionId] as const,
};

export function useExaminations(lesionId: string) {
  return useQuery({
    queryKey: examinationKeys.byLesion(lesionId),
    queryFn: () => listExaminationsByLesion(lesionId),
    enabled: Boolean(lesionId),
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
