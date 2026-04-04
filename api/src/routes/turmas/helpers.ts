import type { Categoria, DbClassRow, DbCourseRow } from "./types";

export function inferCategoria(courseName: string | null): Categoria {
  const normalized = (courseName ?? "").toLowerCase();
  if (normalized.includes("inform") || normalized.includes("excel") || normalized.includes("office")) {
    return "informatica";
  }
  return "programacao";
}

export function toDurationWeeks(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const weeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, weeks || 1);
}

export function buildEndDate(startDateIso: string, durationWeeks: number): string {
  const d = new Date(startDateIso);
  d.setUTCDate(d.getUTCDate() + durationWeeks * 7);
  return d.toISOString();
}

export function isMissingDatabaseObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "42P01" || code === "42703";
}

export function isNotNullConstraintError(error: unknown): error is { code: string; column?: string | null } {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "23502";
}

export function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return undefined;
}

export function mapPhaseStartStatus(status: number | null, unlockedAt: string | null) {
  if (status === 2) {
    return { key: "concluido", label: "Concluido" };
  }
  if (status === 1) {
    return { key: "em_progresso", label: "Em progresso" };
  }
  if (status === 0) {
    return { key: "nao_iniciado", label: "Nao iniciado" };
  }
  if (unlockedAt) {
    return { key: "em_progresso", label: "Em progresso" };
  }
  return { key: "desconhecido", label: "Desconhecido" };
}

export function mapClassToTurma(row: DbClassRow, course: DbCourseRow | null) {
  return {
    id: String(row.id),
    nome: row.name ?? `Turma ${row.id}`,
    tipo: "turma" as const,
    categoria: inferCategoria(course?.name ?? null),
    professorId: null,
    descricao: course?.description ?? null,
    ativo: true,
    dataInicio: row.start_date,
    duracaoSemanas: toDurationWeeks(row.start_date, row.end_date),
    cronogramaAtivo: false,
    courseId: String(row.course_id),
    currentModuleId: String(row.current_module_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
