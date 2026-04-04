import type { Exercicio } from "../../services/api";

export type CategoriaExercicio = "programacao" | "informatica";

export type RequiredFieldKey = "titulo" | "descricao" | "curso" | "modulo" | "fase" | "prazo" | "multipla" | "ordem";

export type InfoOverlayKey = "dificuldade" | "ordem";

export type ExerciseListViewItem = {
  ex: Exercicio;
  alunoIds: string[];
  hasAlunoAssignment: boolean;
  turmaIds: string[];
  publishedAtMs: number | null;
  prazoMs: number | null;
};

export type ExercisesVirtualWindow = {
  visibleItems: ExerciseListViewItem[];
  topSpacerHeight: number;
  bottomSpacerHeight: number;
};

export type RespostasAlunoOption = {
  id: string;
  nome: string;
  email: string;
  totalRespostas: number;
  totalExercicios: number;
  lastAnsweredAt: string | null;
};

export type RespostasExercicioOption = {
  id: string;
  titulo: string;
  modulo: string | null;
  tema: string | null;
  totalRespostas: number;
  lastAnsweredAt: string | null;
};

export type RespostaDiretaOption = {
  answerId: number;
  questionId: number;
  answeredAt: string | null;
  isCorrect: boolean | null;
};
