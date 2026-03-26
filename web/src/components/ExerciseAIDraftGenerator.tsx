import React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
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

  async function runGenerate() {
    const draft = await generateDraft();
    if (!draft) {
      return;
    }

    onApplyDraft(draft);
  }

  async function handleGenerate() {
    if (hasContentToOverwrite) {
      setConfirmOpen(true);
      return;
    }

    await runGenerate();
  }

  return (
    <>
      <div className="rounded-[24px] border border-border/70 bg-card/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Groq Draft Generator
            </p>
            <h3 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <Sparkles size={16} />
              Gerar rascunho com IA
            </h3>
          </div>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGenerate}
            onClick={() => void handleGenerate()}
          >
            {loading ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : <Sparkles size={15} />}
            {loading ? "Gerando..." : "Gerar rascunho"}
          </button>
        </div>

        <p
          className={
            contextReady
              ? "mt-4 text-sm leading-6 text-muted-foreground"
              : "mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-sm leading-6 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300"
          }
        >
          {statusMessage}
        </p>

        <label className="mt-4 flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Prompt editorial
          </span>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/30"
            value={prompt}
            onChange={(event) => {
              clearMessages();
              setPrompt(event.target.value);
            }}
            placeholder="Ex.: gere uma pergunta direta sobre consumo de API REST com filtros, estados de loading e tratamento de erro."
            disabled={loading}
          />
        </label>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200/70 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-300">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300">
            {successMessage}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Sobrescrever conteúdo atual"
        message="Ja existem campos preenchidos neste formulario. Deseja sobrescrever titulo, pergunta, dificuldade, pontos de resgate e os campos editoriais com o rascunho da IA?"
        confirmText="Sobrescrever"
        cancelText="Cancelar"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void runGenerate();
        }}
      />
    </>
  );
}
