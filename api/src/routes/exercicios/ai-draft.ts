import { z } from "zod";
import { pool } from "../../db";
import type { ExerciseAIDraft } from "./types";
import { getDifficultyLabel, normalizeDraftQuestionText, isDirectQuestionText } from "./helpers";

const groqDraftJsonSchema = {
  name: "exercise_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      titulo: { type: "string" },
      descricao: { type: "string" },
      difficulty: {
        type: "integer",
        minimum: 1,
      },
      pointsRedeem: {
        type: "integer",
        minimum: 0,
      },
      suggestedComponentType: {
        type: "string",
        enum: ["escrita", "multipla"],
      },
      multiplaQuestoes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            pergunta: { type: "string" },
            opcoes: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  letter: {
                    type: "string",
                    enum: ["A", "B", "C", "D"],
                  },
                  text: { type: "string" },
                },
                required: ["letter", "text"],
              },
            },
            respostaCorreta: {
              type: "string",
              enum: ["A", "B", "C", "D"],
            },
          },
          required: ["pergunta", "opcoes", "respostaCorreta"],
        },
      },
    },
    required: ["titulo", "descricao", "difficulty", "pointsRedeem", "suggestedComponentType", "multiplaQuestoes"],
  },
} as const;

const aiDraftResponseSchema = z.object({
  titulo: z.string().trim().min(2),
  descricao: z.string().trim().min(10),
  difficulty: z.coerce.number().int().min(1),
  pointsRedeem: z.coerce.number().int().min(0),
  suggestedComponentType: z.enum(["escrita", "multipla"]),
  multiplaQuestoes: z.array(
    z.object({
      pergunta: z.string().trim().min(2),
      opcoes: z.array(
        z.object({
          letter: z.enum(["A", "B", "C", "D"]),
          text: z.string().trim().min(1),
        })
      ).length(4),
      respostaCorreta: z.enum(["A", "B", "C", "D"]),
    })
  ),
}).superRefine((draft, ctx) => {
  if (!isDirectQuestionText(draft.descricao)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A pergunta principal precisa estar em formato interrogativo e terminar com '?'.",
      path: ["descricao"],
    });
  }

  draft.multiplaQuestoes.forEach((questao, index) => {
    if (!isDirectQuestionText(questao.pergunta)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A pergunta da multipla escolha precisa estar em formato interrogativo e terminar com '?'.",
        path: ["multiplaQuestoes", index, "pergunta"],
      });
    }
  });
});

export async function resolveGenerationContext(courseId: number, moduleId: number, phaseId: number) {
  const result = await pool.query<{
    course_id: number;
    course_name: string | null;
    module_id: number;
    module_name: string | null;
    phase_id: number;
    phase_name: string | null;
  }>(
    `SELECT
       c.id AS course_id,
       c.name AS course_name,
       m.id AS module_id,
       m.name AS module_name,
       p.id AS phase_id,
       p.name AS phase_name
     FROM phase p
     JOIN module m ON m.id = p.module_id
     JOIN course c ON c.id = m.course_id
     WHERE p.id = $1
     LIMIT 1`,
    [phaseId]
  );

  const row = result.rows[0];
  if (!row) return null;
  if (row.course_id !== courseId || row.module_id !== moduleId) {
    return null;
  }

  return row;
}

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    } | null;
  }>;
  error?: {
    message?: string;
  };
  message?: string;
};

export async function generateExerciseDraftWithGroq(input: {
  prompt: string;
  categoria: "programacao" | "informatica";
  componentType: "escrita" | "multipla";
  difficulty: number | null | undefined;
  courseName: string | null;
  moduleName: string | null;
  phaseName: string | null;
}) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY nao configurada no servidor.");
  }

  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    const isRetry = attempt > 0;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: isRetry ? 0.3 : 0.6,
          max_completion_tokens: 1200,
          response_format: {
            type: "json_schema",
            json_schema: groqDraftJsonSchema,
          },
          messages: [
            {
              role: "system",
              content:
                "Voce gera rascunhos de exercicios em portugues do Brasil para um portal educacional. Responda somente JSON valido no schema pedido, sem markdown. O titulo deve ser curto e claro. A descricao deve ser exatamente a pergunta principal que aparecera no campo Pergunta, escrita diretamente para o aluno em formato interrogativo. Ela deve terminar com '?' e nao pode comecar com verbos no imperativo como 'Crie', 'Desenvolva', 'Escreva', 'Implemente', 'Monte' ou equivalentes. Prefira formulacoes como 'Como voce...', 'Qual seria...' ou 'De que forma voce...'. Retorne difficulty como inteiro valido do sistema, usando 1 para Normal, 2 para Lower e 3 para Prova Semanal. Retorne pointsRedeem como inteiro maior ou igual a zero, coerente com a dificuldade. Retorne suggestedComponentType como 'escrita' ou 'multipla', escolhendo o formato que melhor combina com a atividade. Use 'multipla' somente quando fizer sentido avaliar por alternativas objetivas. Se o suggestedComponentType for escrita, retorne multiplaQuestoes vazia. Se o suggestedComponentType for multipla, retorne exatamente 1 questao com 4 opcoes A-D e exatamente 1 correta, e a pergunta dessa questao tambem deve terminar com '?'. Nao inclua observacoes fora do JSON.",
            },
            {
              role: "user",
              content: [
                `Curso: ${input.courseName ?? "Nao informado"}`,
                `Modulo: ${input.moduleName ?? "Nao informado"}`,
                `Fase: ${input.phaseName ?? "Nao informado"}`,
                `Categoria: ${input.categoria}`,
                `Tipo atualmente selecionado no formulario: ${input.componentType}`,
                input.difficulty != null
                  ? `Dificuldade ja selecionada no formulario: ${getDifficultyLabel(input.difficulty)}. Mantenha esse nivel ao responder difficulty.`
                  : "Dificuldade ainda nao selecionada no formulario. Escolha o nivel mais adequado e retorne em difficulty.",
                "Voce pode manter o tipo atual ou sugerir outro melhor em suggestedComponentType.",
                "Formato obrigatorio da pergunta: uma unica pergunta direta ao aluno, terminando com '?'.",
                "Nao entregue descricao de briefing, lista de requisitos, passo a passo ou texto no imperativo.",
                "PointsRedeem: defina um valor inteiro coerente com a complexidade do exercicio.",
                isRetry
                  ? "Correcao obrigatoria: a tentativa anterior nao veio em formato de pergunta. Reescreva o campo principal como pergunta real terminando com '?'."
                  : "Primeira tentativa: gere a pergunta principal diretamente no formato final do formulario.",
                `Pedido editorial: ${input.prompt}`,
              ].join("\n"),
            },
          ],
        }),
      });

      const payload = await response.json().catch(() => null) as GroqChatCompletionResponse | null;
      if (!response.ok) {
        const message =
          payload && typeof payload === "object"
            ? ((payload as { error?: { message?: string } }).error?.message
              ?? (payload as { message?: string }).message
              ?? "Erro ao gerar rascunho no Groq.")
            : "Erro ao gerar rascunho no Groq.";
        throw new Error(message);
      }

      const rawContent = payload?.choices?.[0]?.message?.content;
      if (typeof rawContent !== "string" || rawContent.trim().length === 0) {
        throw new Error("Groq nao retornou um rascunho valido.");
      }

      const parsedContent = JSON.parse(rawContent);
      const parsedDraft = aiDraftResponseSchema.parse(parsedContent);

      if (parsedDraft.suggestedComponentType === "escrita") {
        return {
          titulo: parsedDraft.titulo.trim(),
          descricao: normalizeDraftQuestionText(parsedDraft.descricao),
          difficulty: parsedDraft.difficulty,
          pointsRedeem: parsedDraft.pointsRedeem,
          suggestedComponentType: "escrita",
          multiplaQuestoes: [],
        } satisfies ExerciseAIDraft;
      }

      if (parsedDraft.multiplaQuestoes.length !== 1) {
        throw new Error("Groq retornou uma estrutura invalida para multipla escolha.");
      }

      return {
        titulo: parsedDraft.titulo.trim(),
        descricao: normalizeDraftQuestionText(parsedDraft.descricao),
        difficulty: parsedDraft.difficulty,
        pointsRedeem: parsedDraft.pointsRedeem,
        suggestedComponentType: "multipla",
        multiplaQuestoes: parsedDraft.multiplaQuestoes.map((questao) => ({
          ...questao,
          pergunta: normalizeDraftQuestionText(questao.pergunta),
        })),
      } satisfies ExerciseAIDraft;
    } catch (error) {
      lastError = error;
      const isRetryableValidationError =
        error instanceof z.ZodError
        || (error instanceof Error && error.message.includes("estrutura invalida"));

      if (!isRetryableValidationError || isRetry) {
        if (error instanceof z.ZodError) {
          throw new Error("Groq nao retornou uma pergunta valida para o campo principal.");
        }
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Nao foi possivel gerar uma pergunta valida com IA.");
}
