import type { ExercicioFase, Fase, Modulo } from "@/services/api";

export type MaterialExerciseOption = {
  id: string;
  label: string;
  phaseId: string;
  phaseName: string;
  moduleId: string;
  moduleName: string;
};

export type MaterialExerciseGroup = {
  moduleId: string;
  moduleName: string;
  phases: Array<{
    phaseId: string;
    phaseName: string;
    options: MaterialExerciseOption[];
  }>;
};

export function collectMaterialExerciseGroups(
  modules: Modulo[],
  phases: Fase[],
  exercisesByPhase: Map<string, ExercicioFase[]>
): MaterialExerciseGroup[] {
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const groups = new Map<string, MaterialExerciseGroup>();

  for (const phase of phases) {
    const module = modulesById.get(phase.moduleId);
    if (!module) continue;

    let group = groups.get(module.id);
    if (!group) {
      group = {
        moduleId: module.id,
        moduleName: module.nome,
        phases: [],
      };
      groups.set(module.id, group);
    }

    let phaseGroup = group.phases.find((item) => item.phaseId === phase.id);
    if (!phaseGroup) {
      phaseGroup = {
        phaseId: phase.id,
        phaseName: phase.nome,
        options: [],
      };
      group.phases.push(phaseGroup);
    }

    const exercises = exercisesByPhase.get(phase.id) ?? [];
    for (const exercise of exercises) {
      phaseGroup.options.push({
        id: exercise.id,
        label: exercise.titulo,
        phaseId: phase.id,
        phaseName: phase.nome,
        moduleId: module.id,
        moduleName: module.nome,
      });
    }
  }

  return modules
    .map((module) => groups.get(module.id))
    .filter((group): group is MaterialExerciseGroup => !!group && group.phases.some((phase) => phase.options.length > 0));
}
