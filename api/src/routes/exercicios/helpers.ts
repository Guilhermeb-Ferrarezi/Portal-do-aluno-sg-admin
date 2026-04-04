import type {
  TipoExercicio,
  MultiplaQuestao,
  NewExerciseRow,
  ExerciseAIDraft,
} from "./types";

export function detectarTipoExercicio(titulo: string, descricao: string): TipoExercicio {
  const texto = `${titulo} ${descricao}`.toLowerCase();

  const palavrasCodigo = [
    "código",
    "codigo",
    "programar",
    "implementar",
    "função",
    "funcao",
    "algoritmo",
    "script",
    "class",
    "classe",
    "def",
    "function",
    "const",
    "let",
    "var",
    "criar um programa",
    "escrever um código",
    "escrever codigo",
    "looping",
    "mostra",
    "for",
    "while",
    "repetindo",
    "lista",
    "percorrendo",
    "número",
    "numero",
    "programa",
    "ação",
    "açao",
    "acao",
    "log",
    "()" ,
    "js",
    "python",
    "c#",
    "c++",
    "javaScript",
    "hello"
  ];

  const palavrasTexto = [
    "dissertação",
    "dissertacao",
    "redação",
    "redacao",
    "escrever sobre",
    "descrever",
    "explicar",
    "argumento",
    "opinião",
    "opiniao",
    "análise",
    "analise",
    "resumo",
    "resenha",
    "texto",
    "redação",
  ];

  if (titulo.includes("Mouse") || descricao.includes("mouse") || titulo.includes("mouse")) {
    return "texto";
  }
  if (
    titulo.includes("Múltipla Escolha") ||
    titulo.includes("multipla escolha") ||
    titulo.includes("pergunta múltipla") ||
    descricao.includes("múltipla escolha") ||
    descricao.includes("multipla escolha")
  ) {
    return "texto";
  }

  const scoreCodigo = palavrasCodigo.filter((p) => texto.includes(p)).length;
  const scoreTexto = palavrasTexto.filter((p) => texto.includes(p)).length;

  if (scoreCodigo > scoreTexto) return "codigo";
  if (scoreTexto > scoreCodigo) return "texto";

  if (/[{}<>=;()\[\]]/.test(texto)) return "codigo";

  return "texto";
}

export function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeNewSchemaBody(body: unknown) {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    ...raw,
    phase_id: raw.phase_id ?? raw.fase_id ?? null,
    course_id: raw.course_id ?? raw.courseId ?? null,
    video_url: raw.video_url ?? raw.videoUrl ?? null,
    index_order: raw.index_order ?? raw.indexOrder ?? null,
    is_final_exercise: raw.is_final_exercise ?? raw.isFinalExercise ?? null,
    is_daily_task: raw.is_daily_task ?? raw.isDailyTask ?? null,
    points_redeem: raw.points_redeem ?? raw.pointsRedeem ?? null,
    exercise_period: raw.exercise_period ?? raw.exercisePeriod ?? null,
    multipla_regras: raw.multipla_regras ?? raw.multiplaRegras ?? null,
  };
}

export function mapTipoExercicioToTypeExercise(tipo: string | null | undefined): number {
  const normalized = (tipo ?? "").toLowerCase();
  if (normalized === "codigo") return 0;
  if (normalized === "multipla") return 1;
  if (normalized === "escrita" || normalized === "texto") return 2;
  return 2;
}

export function mapTypeExerciseToTipoExercicio(value: unknown): TipoExercicio {
  const normalized = Number(value);
  if (normalized === 0) return "codigo";
  if (normalized === 1) return "multipla";
  if (normalized === 2) return "escrita";
  return "nenhum";
}

export function getDifficultyLabel(value: number | null | undefined) {
  if (value === 2) return "Lower";
  if (value === 3) return "Prova Semanal";
  if (value != null && value >= 4) return `Nivel ${value}`;
  return "Normal";
}

export function getMultiplaQuestoesFromPayload(input: unknown): MultiplaQuestao[] {
  let value = input;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  const raw =
    value && typeof value === "object"
      ? (value as { questoes?: unknown[]; Questoes?: unknown[] })
      : null;
  const rawQuestoes = Array.isArray(raw?.questoes)
    ? raw.questoes
    : Array.isArray(raw?.Questoes)
      ? raw.Questoes
      : [];

  return rawQuestoes
    .map((questao) => {
      const pergunta = normalizeOptionalText((questao as { pergunta?: unknown })?.pergunta);
      const opcoesRaw = Array.isArray((questao as { opcoes?: unknown[] })?.opcoes)
        ? ((questao as { opcoes?: unknown[] }).opcoes as unknown[])
        : [];
      const opcoes = opcoesRaw
        .map((opcao, index) => ({
          letter: normalizeOptionalText((opcao as { letter?: unknown })?.letter)?.toUpperCase()
            ?? String.fromCharCode(65 + index),
          text: normalizeOptionalText((opcao as { text?: unknown })?.text) ?? "",
        }))
        .filter((opcao) => opcao.text.length > 0);

      if (!pergunta || opcoes.length === 0) return null;

      const respostaCorretaRaw =
        normalizeOptionalText((questao as { respostaCorreta?: unknown })?.respostaCorreta)?.toUpperCase()
        ?? "";
      const respostaCorreta = opcoes.some((opcao) => opcao.letter === respostaCorretaRaw)
        ? respostaCorretaRaw
        : opcoes[0]?.letter ?? "A";

      return {
        pergunta,
        opcoes,
        respostaCorreta,
      } satisfies MultiplaQuestao;
    })
    .filter((questao): questao is MultiplaQuestao => !!questao);
}

export function stringifyMultiplaQuestoes(questoes: MultiplaQuestao[]) {
  if (questoes.length === 0) return null;
  return JSON.stringify({ questoes });
}

export function getTextAnswerKeyMissingMessage() {
  return "O schema novo de exercicios nao possui campo para gabarito textual. Para suportar esse save sem perder dados, o banco precisa de um campo de texto em public.exercise (ex.: gabarito, answer_key, expected_answer ou solution) ou de uma estrutura dedicada. Nenhuma alteracao foi feita.";
}

export function getMultipleChoicePersistenceMissingMessage() {
  return "O schema novo de exercicios nao possui as tabelas question/question_option necessarias para salvar multipla escolha. Nenhuma alteracao foi feita.";
}

export function mapNewExerciseRow(
  row: NewExerciseRow,
  options: { multiplaQuestoes?: MultiplaQuestao[] } = {}
) {
  const isDailyTask = !!row.is_daily_task || !!row.container_is_daily_task;
  const multiplaQuestoes = options.multiplaQuestoes ?? [];
  const multiplaRegras = stringifyMultiplaQuestoes(multiplaQuestoes);
  const tipoExercicio = mapTypeExerciseToTipoExercicio(row.type_exercise);
  return {
    id: String(row.id),
    titulo: row.title,
    descricao: row.description ?? "",
    phaseId: row.phase_id != null ? String(row.phase_id) : null,
    modulo: row.modulo ?? "Sem modulo",
    tema: row.tema ?? null,
    prazo: row.term_at ?? null,
    publishedAt: null,
    publicado: true,
    isDailyTask,
    tipoExercicio: tipoExercicio !== "nenhum" ? tipoExercicio : (multiplaRegras ? "multipla" : "nenhum"),
    categoria: "programacao",
    mouse_regras: null,
    multipla_regras: multiplaRegras,
    atalho_tipo: null,
    permitir_repeticao: false,
    maxTentativas: null,
    penalidadePorTentativa: null,
    intervaloReenvio: null,
    anexoUrl: null,
    anexoNome: null,
    videoUrl: row.video_url ?? null,
    difficulty: row.difficulty ?? null,
    indexOrder: row.index_order ?? null,
    isFinalExercise: !!row.is_final_exercise,
    pointsRedeem: row.points_redeem ?? null,
    exercisePeriod: row.exercise_period ?? null,
    containerName: row.container_name ?? null,
    containerDay: row.container_day ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseIdArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter((v) => v.trim().length > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v)).filter((v) => v.trim().length > 0);
      }
    } catch {
      // ignore JSON parse errors
    }
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export const QUESTION_IMPERATIVE_PREFIXES = [
  "crie ",
  "desenvolva ",
  "escreva ",
  "implemente ",
  "monte ",
  "faca ",
  "faça ",
  "construa ",
  "produza ",
  "elabore ",
  "liste ",
  "descreva ",
] as const;

export function normalizeDraftQuestionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function isDirectQuestionText(value: string) {
  const normalized = normalizeDraftQuestionText(value);
  if (normalized.length < 10 || !normalized.endsWith("?")) {
    return false;
  }

  const asciiNormalized = normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return !QUESTION_IMPERATIVE_PREFIXES.some((prefix) => asciiNormalized.startsWith(prefix));
}
