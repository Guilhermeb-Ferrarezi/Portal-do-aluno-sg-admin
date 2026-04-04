import { pool } from "../../db";
import type { Queryable, MultiplaQuestao, NewSchemaQuestionRow } from "./types";
import { normalizeOptionalText } from "./helpers";

export async function loadNewSchemaMultiplaMap(db: Queryable, exerciseIds: number[]) {
  const normalizedIds = Array.from(new Set(exerciseIds.filter((id) => Number.isInteger(id) && id > 0)));
  const map = new Map<number, MultiplaQuestao[]>();
  if (normalizedIds.length === 0) return map;

  const result = await db.query(
    `SELECT
       q.exercise_id,
       q.id AS question_id,
       q.statement AS question_statement,
       qo.id AS option_id,
       qo.option_text,
       qo.is_correct
     FROM question q
     LEFT JOIN question_option qo ON qo.question_id = q.id
     WHERE q.exercise_id = ANY($1::int[])
     ORDER BY q.exercise_id ASC, q.id ASC, qo.id ASC`,
    [normalizedIds]
  ) as { rows: NewSchemaQuestionRow[] };

  const questionMap = new Map<number, Map<number, MultiplaQuestao>>();
  for (const row of result.rows) {
    if (!row.question_id) continue;
    const byExercise = questionMap.get(row.exercise_id) ?? new Map<number, MultiplaQuestao>();
    if (!questionMap.has(row.exercise_id)) {
      questionMap.set(row.exercise_id, byExercise);
    }

    const pergunta = normalizeOptionalText(row.question_statement) ?? "Em aberto";
    const questao =
      byExercise.get(row.question_id) ?? {
        pergunta,
        opcoes: [],
        respostaCorreta: "",
      };

    if (row.option_id && normalizeOptionalText(row.option_text)) {
      const letter = String.fromCharCode(65 + questao.opcoes.length);
      questao.opcoes.push({
        letter,
        text: normalizeOptionalText(row.option_text) ?? "",
      });
      if (row.is_correct) {
        questao.respostaCorreta = letter;
      }
    }

    byExercise.set(row.question_id, questao);
  }

  for (const [exerciseId, byQuestion] of questionMap.entries()) {
    const questoes = Array.from(byQuestion.values())
      .filter((questao) => questao.opcoes.length > 0)
      .map((questao) => ({
        ...questao,
        respostaCorreta: questao.respostaCorreta || questao.opcoes[0]?.letter || "A",
      }));

    if (questoes.length > 0) {
      map.set(exerciseId, questoes);
    }
  }

  return map;
}

export async function clearNewSchemaQuestions(db: Queryable, exerciseId: number) {
  await db.query(
    `DELETE FROM question_option
     WHERE question_id IN (
       SELECT id
       FROM question
       WHERE exercise_id = $1
     )`,
    [exerciseId]
  );
  await db.query(`DELETE FROM question WHERE exercise_id = $1`, [exerciseId]);
}

export async function countNewSchemaAnswers(db: Queryable, exerciseId: number) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM answer
     WHERE exercise_id = $1`,
    [exerciseId]
  ) as { rows: Array<{ total: number }> };
  return Number(result.rows[0]?.total ?? 0);
}

export async function syncNewSchemaMultiplaQuestoes(
  db: Queryable,
  exerciseId: number,
  nextQuestoes: MultiplaQuestao[]
) {
  const currentMap = await loadNewSchemaMultiplaMap(db, [exerciseId]);
  const currentQuestoes = currentMap.get(exerciseId) ?? [];
  const currentJson = JSON.stringify(currentQuestoes);
  const nextJson = JSON.stringify(nextQuestoes);

  if (currentJson === nextJson) {
    return;
  }

  if (currentQuestoes.length > 0 || nextQuestoes.length > 0) {
    const answersCount = await countNewSchemaAnswers(db, exerciseId);
    if (answersCount > 0) {
      throw new Error("Nao e possivel alterar as questoes de multipla escolha desse exercicio porque ja existem respostas vinculadas no schema novo.");
    }
  }

  await clearNewSchemaQuestions(db, exerciseId);

  for (const questao of nextQuestoes) {
    const createdQuestion = await db.query(
      `INSERT INTO question (statement, exercise_id)
       VALUES ($1, $2)
       RETURNING id`,
      [questao.pergunta, exerciseId]
    ) as { rows: Array<{ id: number }> };

    const questionId = createdQuestion.rows[0]?.id;
    if (!questionId) continue;

    for (const opcao of questao.opcoes) {
      await db.query(
        `INSERT INTO question_option (question_id, option_text, is_correct)
         VALUES ($1, $2, $3)`,
        [questionId, opcao.text, opcao.letter === questao.respostaCorreta]
      );
    }
  }
}

export async function getPhaseWithModuleById(phaseId: number) {
  const result = await pool.query<{
    phase_id: number;
    phase_name: string | null;
    module_name: string | null;
    course_id: number;
  }>(
    `SELECT
       p.id AS phase_id,
       p.name AS phase_name,
       m.name AS module_name,
       m.course_id
     FROM phase p
     JOIN module m ON m.id = p.module_id
     WHERE p.id = $1
     LIMIT 1`,
    [phaseId]
  );
  return result.rows[0] ?? null;
}

export async function realignExerciseIdSequence() {
  const seqResult = await pool.query<{ seq_name: string | null }>(
    `SELECT pg_get_serial_sequence('exercise', 'id') AS seq_name`
  );
  const seqName = seqResult.rows[0]?.seq_name;
  if (!seqName) return;

  await pool.query(
    `SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM exercise), 0) + 1, false)`,
    [seqName]
  );
}

export async function findSmallestAvailableIndexOrder(phaseId: number, excludeExerciseId?: number) {
  const params: unknown[] = [phaseId];
  let where = "phase_id = $1";
  if (excludeExerciseId !== undefined) {
    params.push(excludeExerciseId);
    where += ` AND id <> $${params.length}`;
  }

  const usedRows = await pool.query<{ index_order: number | null }>(
    `SELECT index_order
     FROM exercise
     WHERE ${where} AND index_order IS NOT NULL
     ORDER BY index_order ASC`,
    params
  );

  let candidate = 1;
  for (const row of usedRows.rows) {
    const idx = Number(row.index_order);
    if (!Number.isInteger(idx) || idx < 1) continue;
    if (idx === candidate) {
      candidate += 1;
      continue;
    }
    if (idx > candidate) break;
  }

  return candidate;
}

export async function getIndexOrderConflictInfo(
  phaseId: number,
  indexOrder: number,
  excludeExerciseId?: number
) {
  const params: unknown[] = [phaseId, indexOrder];
  let extraFilter = "";
  if (excludeExerciseId !== undefined) {
    params.push(excludeExerciseId);
    extraFilter = `AND id <> $${params.length}`;
  }

  const existsResult = await pool.query<{ taken: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM exercise
       WHERE phase_id = $1
         AND index_order = $2
         ${extraFilter}
     ) AS taken`,
    params
  );

  if (!existsResult.rows[0]?.taken) {
    return { taken: false as const, smallestAvailable: indexOrder };
  }

  const smallestAvailable = await findSmallestAvailableIndexOrder(phaseId, excludeExerciseId);
  return { taken: true as const, smallestAvailable };
}
