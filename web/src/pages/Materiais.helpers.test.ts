import { describe, expect, test } from "vitest";
import type { ExercicioFase, Fase, Modulo } from "@/services/api";
import { collectMaterialExerciseGroups } from "./Materiais.helpers";

describe("collectMaterialExerciseGroups", () => {
  test("groups exercises by module and ignores empty phases", () => {
    const modules: Modulo[] = [
      { id: "7", nome: "Modulo 1", courseId: "2", indexOrder: 1 },
      { id: "8", nome: "Modulo 2", courseId: "2", indexOrder: 2 },
    ];
    const phases: Fase[] = [
      { id: "11", moduleId: "7", nome: "Base", weekNumber: 1, indexOrder: 1, adminAuthorize: false },
      { id: "12", moduleId: "7", nome: "Avançado", weekNumber: 2, indexOrder: 2, adminAuthorize: false },
      { id: "13", moduleId: "8", nome: "Extra", weekNumber: 3, indexOrder: 3, adminAuthorize: false },
    ];
    const exercisesByPhase = new Map<string, ExercicioFase[]>([
      [
        "11",
        [
          { id: "32", titulo: "HTML semantico", descricao: "", indexOrder: 2, difficulty: null, typeExercise: null, isDailyTask: false, phaseId: "11", createdAt: "2026-05-13T00:00:00.000Z", updatedAt: "2026-05-13T00:00:00.000Z" },
          { id: "33", titulo: "CSS grid", descricao: "Conteudo", indexOrder: 1, difficulty: null, typeExercise: null, isDailyTask: false, phaseId: "11", createdAt: "2026-05-13T00:00:00.000Z", updatedAt: "2026-05-13T00:00:00.000Z" },
        ],
      ],
      ["12", []],
      [
        "13",
        [
          { id: "44", titulo: "JS básico", descricao: "", indexOrder: 1, difficulty: null, typeExercise: null, isDailyTask: false, phaseId: "13", createdAt: "2026-05-13T00:00:00.000Z", updatedAt: "2026-05-13T00:00:00.000Z" },
        ],
      ],
    ]);

    expect(collectMaterialExerciseGroups(modules, phases, exercisesByPhase)).toEqual([
      {
        moduleId: "7",
        moduleName: "Modulo 1",
        phases: [
          {
            phaseId: "11",
            phaseName: "Base",
            options: [
              {
                id: "32",
                label: "HTML semantico",
                phaseId: "11",
                phaseName: "Base",
                moduleId: "7",
                moduleName: "Modulo 1",
              },
              {
                id: "33",
                label: "CSS grid",
                phaseId: "11",
                phaseName: "Base",
                moduleId: "7",
                moduleName: "Modulo 1",
              },
            ],
          },
        ],
      },
      {
        moduleId: "8",
        moduleName: "Modulo 2",
        phases: [
          {
            phaseId: "13",
            phaseName: "Extra",
            options: [
              {
                id: "44",
                label: "JS básico",
                phaseId: "13",
                phaseName: "Extra",
                moduleId: "8",
                moduleName: "Modulo 2",
              },
            ],
          },
        ],
      },
    ]);
  });
});
