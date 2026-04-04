import type {
  Exercicio,
  ExerciseAIDraft,
  ExerciseAnswerStudent,
  AnsweredExerciseByStudent,
  User,
} from "../../services/api";
import type {
  CategoriaExercicio,
  RequiredFieldKey,
  RespostasAlunoOption,
  RespostasExercicioOption,
  RespostaDiretaOption,
} from "./types";

export type MultipleChoiceOption = { letter: string; text: string };
export type MultipleChoiceQuestion = {
  pergunta: string;
  opcoes: MultipleChoiceOption[];
  respostaCorreta: string;
};

export type MouseRules = {
  clicksSimples: number;
  duplosClicks: number;
  clicksDireitos: number;
};

export type ExerciseStatusFilter = "todos" | "publicado" | "programado" | "rascunho";

export function createDefaultMouseRules(): MouseRules {
  return {
    clicksSimples: 0,
    duplosClicks: 0,
    clicksDireitos: 0,
  };
}

export function createDefaultMultipleChoiceQuestion(): MultipleChoiceQuestion {
  return {
    pergunta: "",
    opcoes: [
      { letter: "A", text: "" },
      { letter: "B", text: "" },
      { letter: "C", text: "" },
      { letter: "D", text: "" },
    ],
    respostaCorreta: "",
  };
}

export function getAlunoIds(exercicio: Exercicio): string[] {
  const alunos = Array.isArray((exercicio as any).alunos)
    ? (exercicio as any).alunos.map((a: any) => a?.id).filter(Boolean)
    : [];
  const idsSnake = Array.isArray((exercicio as any).aluno_ids)
    ? (exercicio as any).aluno_ids
    : [];
  const idsCamel = Array.isArray((exercicio as any).alunoIds)
    ? (exercicio as any).alunoIds
    : [];
  return Array.from(new Set([...alunos, ...idsSnake, ...idsCamel]));
}

export function getAlunoNames(exercicio: Exercicio, alunoNameById: Map<string, string>): string[] {
  const alunos = Array.isArray((exercicio as any).alunos)
    ? (exercicio as any).alunos
      .map((a: any) => a?.nome || a?.usuario || a?.id)
      .filter(Boolean)
    : [];
  if (alunos.length > 0) return alunos as string[];

  return getAlunoIds(exercicio)
    .map((id) => alunoNameById.get(id))
    .filter((nome): nome is string => !!nome);
}

export function formatAlunoLabel(names: string[]) {
  if (names.length === 0) return "Aluno especifico";
  if (names.length === 1) return `Para: ${names[0]}`;
  if (names.length === 2) return `Para: ${names.join(", ")}`;
  return `Para: ${names[0]} +${names.length - 1}`;
}

export function formatIsoToDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function isExerciseScheduled(ex: Exercicio, now: Date = new Date()) {
  return !!(ex.publishedAt && new Date(ex.publishedAt) > now);
}

export function isExercisePublished(ex: Exercicio) {
  return ex.publicado !== false;
}

export function buildAlunoNameMap(alunos: User[]) {
  const map = new Map<string, string>();
  alunos.forEach((aluno) => {
    map.set(aluno.id, aluno.nome || aluno.usuario || aluno.id);
  });
  return map;
}

export type ExerciseFilterInput = {
  isStaff: boolean;
  userId: string | null;
  buscaFiltro: string;
  moduloFiltro: string;
  tipoFiltro: string;
  statusFiltro: ExerciseStatusFilter;
  turmaFiltro: string;
};

export function filterExercises(items: Exercicio[], filters: ExerciseFilterInput) {
  const {
    isStaff,
    userId,
    buscaFiltro,
    moduloFiltro,
    tipoFiltro,
    statusFiltro,
    turmaFiltro,
  } = filters;

  return items.filter((ex) => {
    const alunoIds = getAlunoIds(ex);
    const hasAlunoAssignment = alunoIds.length > 0;

    if (!isStaff && hasAlunoAssignment) {
      if (!userId || !alunoIds.includes(userId)) return false;
    }

    if (buscaFiltro && !ex.titulo.toLowerCase().includes(buscaFiltro.toLowerCase())) {
      return false;
    }

    if (moduloFiltro && ex.modulo !== moduloFiltro) {
      return false;
    }

    if (tipoFiltro && ex.tipoExercicio !== tipoFiltro) {
      return false;
    }

    if (isStaff && statusFiltro !== "todos") {
      const isPublished = isExercisePublished(ex);
      const isScheduled = isExerciseScheduled(ex);
      if (statusFiltro === "rascunho" && (isPublished || isScheduled)) return false;
      if (statusFiltro === "programado" && !isScheduled) return false;
      if (statusFiltro === "publicado" && (!isPublished || isScheduled)) return false;
    }

    if (turmaFiltro === "todas") return true;
    if (hasAlunoAssignment) return false;
    return ex.turmas?.some((t) => t.id === turmaFiltro);
  });
}

export function normalizeListPayload<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray((payload as { items?: T[] }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

export function inferCategoriaFromCourseName(courseName: string | null | undefined): CategoriaExercicio {
  const normalized = (courseName ?? "").toLowerCase();
  if (normalized.includes("inform") || normalized.includes("excel") || normalized.includes("office")) {
    return "informatica";
  }
  return "programacao";
}

export function getTipoInfo(ex: Exercicio): { label: string; className: string } {
  switch (ex.tipoExercicio) {
    case "codigo":
      return { label: "Codigo", className: "isCodigo" };
    case "texto":
    case "escrita":
      return { label: "Escrita", className: "isEscrita" };
    case "mouse":
      return { label: "Mouse", className: "isMouse" };
    case "multipla":
      return { label: "Multipla", className: "isMultipla" };
    case "atalho":
      return { label: "Atalho", className: "isAtalho" };
    default:
      return { label: "Exercicio", className: "isDefault" };
  }
}

export function parseDifficultyValue(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const legacyMap: Record<string, number> = {
    normal: 1,
    lower: 2,
    prova_semanal: 3,
  };

  const mapped = legacyMap[normalized] ?? Number(normalized);
  if (!Number.isInteger(mapped) || mapped < 1) return null;
  return mapped;
}

export function buildMultiplaQuestoesPayload(
  questoes: MultipleChoiceQuestion[],
  perguntaBase: string
) {
  const fallbackPergunta = perguntaBase.trim();
  return questoes.map((questao, index) => ({
    ...questao,
    pergunta: fallbackPergunta || `Questao ${index + 1}`,
  }));
}

export function buildMultiplaRegrasValue(
  questoes: MultipleChoiceQuestion[],
  perguntaBase: string
) {
  return JSON.stringify({ questoes: buildMultiplaQuestoesPayload(questoes, perguntaBase) });
}

export function getMultiplaQuestoesFromRegras(rawRegras: string | null | undefined): MultipleChoiceQuestion[] {
  const fallback = [createDefaultMultipleChoiceQuestion()];
  if (!rawRegras) return fallback;

  try {
    const regras = JSON.parse(rawRegras);
    const questoes: MultipleChoiceQuestion[] = Array.isArray(regras?.questoes)
      ? regras.questoes
      : Array.isArray(regras?.Questoes)
        ? regras.Questoes
        : [];
    return questoes.length > 0 ? questoes : fallback;
  } catch {
    return fallback;
  }
}

export function getExerciseEditorComponentType(exercicio: Exercicio): "escrita" | "multipla" {
  if (exercicio.tipoExercicio === "multipla") return "multipla";
  if (exercicio.tipoExercicio === "escrita" || exercicio.tipoExercicio === "texto") return "escrita";
  if (Boolean((exercicio as any).multipla_regras)) return "multipla";
  return "escrita";
}

export function mapDraftMultiplaQuestoes(draft: ExerciseAIDraft): MultipleChoiceQuestion[] {
  if (draft.multiplaQuestoes.length === 0) {
    return [createDefaultMultipleChoiceQuestion()];
  }

  return draft.multiplaQuestoes.map((questao) => ({
    pergunta: questao.pergunta ?? "",
    opcoes: questao.opcoes.map((opcao) => ({
      letter: opcao.letter,
      text: opcao.text,
    })),
    respostaCorreta: questao.respostaCorreta ?? "",
  }));
}

export function collectRequiredFieldWarnings(params: {
  tituloFinal: string;
  descricaoFinal: string;
  moduloNome: string;
  phaseIdNum: number;
  courseIdNum: number;
  prazo: string;
  categoria: CategoriaExercicio;
  componenteInterativo: string;
  multiplaQuestoes: MultipleChoiceQuestion[];
}): Partial<Record<RequiredFieldKey, string>> {
  const warnings: Partial<Record<RequiredFieldKey, string>> = {};
  const isInteractiveComponentInformatica = params.categoria === "informatica" && params.componenteInterativo !== "";

  if (!isInteractiveComponentInformatica && params.tituloFinal.length < 2) {
    warnings.titulo = "Titulo obrigatorio (minimo 2 caracteres).";
  }
  if (!isInteractiveComponentInformatica && params.descricaoFinal.length < 2) {
    warnings.descricao = "Descricao obrigatoria (minimo 2 caracteres).";
  }
  if (!Number.isFinite(params.courseIdNum) || params.courseIdNum <= 0) {
    warnings.curso = "Selecione um curso.";
  }
  if (!params.moduloNome) {
    warnings.modulo = "Selecione um modulo.";
  }
  if (!Number.isFinite(params.phaseIdNum) || params.phaseIdNum <= 0) {
    warnings.fase = "Selecione uma fase.";
  }
  if (!params.prazo) {
    warnings.prazo = "Prazo obrigatorio.";
  }
  if (
    params.componenteInterativo === "multipla" &&
    params.multiplaQuestoes.some((q) => !q.respostaCorreta || q.opcoes.some((o) => !o.text))
  ) {
    warnings.multipla = "Complete todas as opcoes e a resposta correta.";
  }
  return warnings;
}

export function mapAnswerStudentsToOptions(alunos: ExerciseAnswerStudent[]): RespostasAlunoOption[] {
  return alunos.map((aluno) => ({
    id: String(aluno.alunoId),
    nome: aluno.alunoNome,
    email: aluno.alunoEmail ?? "",
    totalRespostas: aluno.totalAnswers ?? 0,
    totalExercicios: aluno.totalExercicios ?? 0,
    lastAnsweredAt: aluno.lastAnsweredAt ?? null,
  }));
}

export function mapAnsweredExercisesToOptions(exercicios: AnsweredExerciseByStudent[]): RespostasExercicioOption[] {
  return exercicios.map((exercicio) => ({
    id: String(exercicio.exercicioId),
    titulo: exercicio.exercicioTitulo,
    modulo: exercicio.exercicioModulo ?? null,
    tema: exercicio.exercicioTema ?? null,
    totalRespostas: exercicio.totalAnswers ?? 0,
    lastAnsweredAt: exercicio.lastAnsweredAt ?? null,
  }));
}

export function getRespostasDiretasKey(alunoId: string, exercicioId: string) {
  return `${alunoId}:${exercicioId}`;
}

export function getRespostaDiretaValue(resposta: RespostaDiretaOption) {
  return `${resposta.answerId}:${resposta.questionId}`;
}

export function getRespostaDiretaLabel(resposta: RespostaDiretaOption) {
  return `Resposta #${resposta.answerId} - Pergunta ${resposta.questionId} - ${resposta.answeredAt ? new Date(resposta.answeredAt).toLocaleDateString("pt-BR") : "Sem data"}`;
}

export function parseRespostaDiretaNavState(value: string): {
  answerId: number | null;
  questionId: number | null;
} {
  if (!value) return { answerId: null, questionId: null };
  const [answerIdRaw, questionIdRaw] = value.split(":");
  const answerId = Number(answerIdRaw);
  const questionId = Number(questionIdRaw);
  return {
    answerId: Number.isFinite(answerId) ? answerId : null,
    questionId: Number.isFinite(questionId) ? questionId : null,
  };
}
