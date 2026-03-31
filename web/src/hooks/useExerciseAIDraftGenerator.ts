import React from "react";
import {
  gerarRascunhoExercicioIA,
  type ExerciseAIDraft,
} from "../services/api";

type ExerciseAICategoria = "programacao" | "informatica";
type ExerciseAIComponentType = "escrita" | "multipla";

type UseExerciseAIDraftGeneratorParams = {
  courseId: string;
  moduleId: string;
  phaseId: string;
  categoria: ExerciseAICategoria;
  componentType: ExerciseAIComponentType;
  difficulty: number | null;
};

export function useExerciseAIDraftGenerator(params: UseExerciseAIDraftGeneratorParams) {
  const { courseId, moduleId, phaseId, categoria, componentType, difficulty } = params;
  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const contextReady = Boolean(courseId && moduleId && phaseId);
  const promptReady = prompt.trim().length > 0;
  const canGenerate = contextReady && promptReady && !loading;

  const statusMessage = !contextReady
    ? "Selecione curso, modulo e fase para liberar a geracao."
    : componentType === "multipla"
      ? "A IA vai gerar o rascunho e pode sugerir trocar o tipo se identificar um formato melhor."
      : "A IA vai gerar o rascunho e pode sugerir trocar o tipo se identificar um formato melhor."
  ;

  async function generateDraft(): Promise<ExerciseAIDraft | null> {
    if (!canGenerate) {
      return null;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await gerarRascunhoExercicioIA({
        prompt: prompt.trim(),
        courseId: Number(courseId),
        moduleId: Number(moduleId),
        phaseId: Number(phaseId),
        categoria,
        componentType,
        difficulty,
      });
      return response.draft;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar rascunho com IA.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  function setDraftAppliedMessage(message = "Rascunho aplicado no formulario.") {
    setError(null);
    setSuccessMessage(message);
  }

  return {
    prompt,
    setPrompt,
    loading,
    error,
    successMessage,
    statusMessage,
    contextReady,
    canGenerate,
    clearMessages,
    generateDraft,
    setDraftAppliedMessage,
  };
}
