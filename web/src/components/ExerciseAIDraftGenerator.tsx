import { Sparkles, Loader2 } from "lucide-react";
import { useExerciseAIDraftGenerator } from "../hooks/useExerciseAIDraftGenerator";
import type { ExerciseAIDraft } from "../services/api";

type ExerciseAIDraftGeneratorProps = {
  courseId: string;
  moduleId: string;
  phaseId: string;
  categoria: "programacao" | "informatica";
  componentType: "escrita" | "multipla";
  difficulty: number | null;
  hasContentToOverwrite: boolean;
  onApplyDraft: (draft: ExerciseAIDraft) => void;
};

export default function ExerciseAIDraftGenerator(props: ExerciseAIDraftGeneratorProps) {
  const {
    courseId,
    moduleId,
    phaseId,
    categoria,
    componentType,
    difficulty,
    hasContentToOverwrite,
    onApplyDraft,
  } = props;

  const {
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
  } = useExerciseAIDraftGenerator({
    courseId,
    moduleId,
    phaseId,
    categoria,
    componentType,
    difficulty,
  });

  async function handleGenerate() {
    if (hasContentToOverwrite) {
      const confirmed = window.confirm(
        "Ja existem campos preenchidos neste formulario. Deseja sobrescrever titulo, pergunta, dificuldade, pontos de resgate e os campos editoriais com o rascunho da IA?"
      );
      if (!confirmed) {
        return;
      }
    }

    const draft = await generateDraft();
    if (!draft) {
      return;
    }

    onApplyDraft(draft);
  }

  return (
    <div className="exerciseAiCard">
      <div className="exerciseAiCardHeader">
        <div>
          <p className="exerciseAiEyebrow">Groq Draft Generator</p>
          <h3 className="exerciseAiTitle">
            <Sparkles size={16} />
            Gerar rascunho com IA
          </h3>
        </div>
        <button
          type="button"
          className="exerciseAiGenerateBtn"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {loading ? "Gerando..." : "Gerar rascunho"}
        </button>
      </div>

      <p className={`exerciseAiStatus ${contextReady ? "" : "isWarning"}`}>
        {statusMessage}
      </p>

      <label className="exerciseAiPrompt">
        <span className="exLabel">Prompt editorial</span>
        <textarea
          className="exTextarea"
          value={prompt}
          onChange={(event) => {
            clearMessages();
            setPrompt(event.target.value);
          }}
          placeholder="Ex.: gere uma pergunta direta sobre consumo de API REST com filtros, estados de loading e tratamento de erro."
          disabled={loading}
        />
      </label>

      {error && <div className="exerciseAiFeedback isError">{error}</div>}
      {successMessage && <div className="exerciseAiFeedback isSuccess">{successMessage}</div>}
    </div>
  );
}
