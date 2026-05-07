import type { ContainerGroup } from "@/services/api";

export type MaterialExerciseOption = {
  id: string;
  label: string;
  phaseId: string;
  containerName: string;
  containerTaskId: string;
};

export function collectMaterialExerciseOptions(containers: ContainerGroup[]): MaterialExerciseOption[] {
  const options: MaterialExerciseOption[] = [];

  for (const container of containers) {
    for (const exercise of container.exercises) {
      options.push({
        id: exercise.id,
        label: `${container.name} - ${exercise.title}`,
        phaseId: container.phaseId,
        containerName: container.name,
        containerTaskId: exercise.containerTaskId,
      });
    }
  }

  return options;
}
