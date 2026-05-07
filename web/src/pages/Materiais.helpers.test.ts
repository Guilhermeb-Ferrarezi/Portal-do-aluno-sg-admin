import { describe, expect, test } from "vitest";
import type { ContainerGroup } from "@/services/api";
import { collectMaterialExerciseOptions } from "./Materiais.helpers";

describe("collectMaterialExerciseOptions", () => {
  test("flattens exercises from containers and ignores empty groups", () => {
    const containers: ContainerGroup[] = [
      {
        name: "Base",
        phaseId: "11",
        containerDateTargetInt: 1,
        isDailyTask: false,
        exercises: [
          { id: "32", containerTaskId: "100", title: "HTML semantico", description: null, indexOrder: 2 },
          { id: "33", containerTaskId: "101", title: "CSS grid", description: "Conteudo", indexOrder: 1 },
        ],
      },
      {
        name: "Vazio",
        phaseId: "11",
        containerDateTargetInt: null,
        isDailyTask: false,
        exercises: [],
      },
    ];

    expect(collectMaterialExerciseOptions(containers)).toEqual([
      {
        id: "32",
        label: "Base - HTML semantico",
        phaseId: "11",
        containerName: "Base",
        containerTaskId: "100",
      },
      {
        id: "33",
        label: "Base - CSS grid",
        phaseId: "11",
        containerName: "Base",
        containerTaskId: "101",
      },
    ]);
  });
});
