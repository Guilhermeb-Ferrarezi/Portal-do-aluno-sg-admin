import type { Exercicio, User } from "../../services/api";

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
    if (ex.is_template) return false;
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
