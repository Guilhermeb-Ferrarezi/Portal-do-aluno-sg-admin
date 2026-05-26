import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { uploadToR2 } from "../utils/uploadR2";
import { logActivity } from "../utils/activityLog";
import { getExerciseSchemaInfo } from "./exercicios/schema";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Tipo de arquivo não permitido"));
  },
});

type TipoResposta = "codigo" | "texto";

function getSingleRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseNotaToNumber(nota: unknown): number | null {
  if (nota === null || nota === undefined) return null;
  const parsed = typeof nota === 'string' ? parseFloat(nota) : Number(nota);
  return isNaN(parsed) ? null : parsed;
}

type SubmissaoRow = {
  id: string;
  exercicio_id: string;
  aluno_id: string;
  resposta: string;
  tipo_resposta: TipoResposta;
  linguagem: string | null;
  nota: number | null;
  corrigida: boolean;
  feedback_professor: string | null;
  is_late: boolean;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  created_at: string;
  updated_at: string;
};

const createSubmissaoSchema = z.object({
  resposta: z.string().optional().nullable(),
  tipo_resposta: z.enum(["codigo", "texto"]),
  linguagem: z.string().optional().nullable(),
});

const corrigirSubmissaoSchema = z.object({
  nota: z.number().min(0).max(100),
  feedback: z.string().optional(),
});

const updateAnswerSchema = z.object({
  answer_text: z.string().optional().nullable(),
  selected_option: z.coerce.number().int().optional().nullable(),
  is_correct: z.boolean().optional().nullable(),
  feedback: z.string().optional().nullable(),
});

const batchUpdateAnswersSchema = z.object({
  answer_ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
  patch: updateAnswerSchema,
});

const aiWrittenCorrectionResponseSchema = z.object({
  nota: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(1).max(2000),
});

const groqWrittenCorrectionJsonSchema = {
  name: "written_exercise_correction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      nota: {
        type: "integer",
        minimum: 0,
        maximum: 100,
      },
      feedback: {
        type: "string",
      },
    },
    required: ["nota", "feedback"],
  },
} as const;

let hasAlunoTurmaTableCache: boolean | null = null;

async function hasAlunoTurmaTable(): Promise<boolean> {
  if (hasAlunoTurmaTableCache !== null) return hasAlunoTurmaTableCache;
  const r = await pool.query<{ has_aluno_turma: boolean }>(
    `SELECT to_regclass('public.aluno_turma') IS NOT NULL AS has_aluno_turma`
  );
  hasAlunoTurmaTableCache = !!r.rows[0]?.has_aluno_turma;
  return hasAlunoTurmaTableCache;
}

function mapSubmissaoRow(row: SubmissaoRow) {
  return {
    id: row.id,
    exercicioId: row.exercicio_id,
    alunoId: row.aluno_id,
    resposta: row.resposta,
    tipoResposta: row.tipo_resposta,
    linguagem: row.linguagem,
    nota: parseNotaToNumber(row.nota),
    corrigida: row.corrigida,
    feedbackProfessor: row.feedback_professor,
    isLate: row.is_late ?? false,
    arquivoUrl: row.arquivo_url,
    arquivoNome: row.arquivo_nome,
    createdAt: row.created_at,
  };
}

function normalizarCodigo(codigo: string): string {
  return codigo
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a", "o", "os", "as", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "sem",
  "que", "na", "no", "nas", "nos", "ao", "aos",
  "se", "ser", "sua", "seu", "suas", "seus",
  "como", "mais", "menos", "muito", "muita", "muitos", "muitas",
  "sobre", "entre", "ate", "desde", "tambem", "ja", "voce", "voces",
  "exercicio", "exercicios", "atividade", "atividades", "resposta", "respostas",
]);

function removerAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extrairPalavrasChave(texto: string): string[] {
  const base = removerAcentos(texto.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!base) return [];

  return base
    .split(" ")
    .filter((p) => p.length >= 4 && !STOPWORDS.has(p));
}

function calcularScoreDescricao(descricao: string, resposta: string): number | null {
  const chaves = extrairPalavrasChave(descricao);
  if (chaves.length === 0) return null;

  const respostaSet = new Set(extrairPalavrasChave(resposta));
  let encontrados = 0;

  for (const chave of chaves) {
    if (respostaSet.has(chave)) encontrados++;
  }

  return Math.round((encontrados / chaves.length) * 100);
}

function calcularScoreAderencia(
  resposta: string,
  tipo: TipoResposta,
  descricao: string,
  gabarito: string | null
): number | null {
  if (tipo === "texto") {
    return calcularScoreDescricao(descricao, resposta);
  }

  if (gabarito && tipo === "codigo") {
    const respostaLimpa = normalizarCodigo(resposta);
    const gabaritoLimpo = normalizarCodigo(gabarito);
    const similaridade = calcularSimilaridade(respostaLimpa, gabaritoLimpo);
    return Math.round(similaridade * 100);
  }

  return null;
}

function calcularJaccardTokens(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let inter = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) inter++;
  }
  const uni = tokensA.size + tokensB.size - inter;
  return uni === 0 ? 1 : inter / uni;
}

// Calcula similaridade entre dois textos usando Levenshtein (two-row)
function calcularSimilaridade(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;

  const maxLen = Math.max(lenA, lenB);
  if (maxLen > 5000) {
    return calcularJaccardTokens(a, b);
  }

  let prev = new Array(lenB + 1);
  let curr = new Array(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lenB; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  const distance = prev[lenB];
  return 1 - distance / maxLen;
}

function corrigirAutomaticamente(
  resposta: string,
  gabarito: string | null,
  tipo: TipoResposta
): number | null {
  if (!gabarito) return null;

  if (tipo === "codigo") {
    const respostaLimpa = normalizarCodigo(resposta);
    const gabaritoLimpo = normalizarCodigo(gabarito);
    const similaridade = calcularSimilaridade(respostaLimpa, gabaritoLimpo);
    return Math.round(similaridade * 100);
  }

  return null;
}

async function corrigirRespostaEscritaComIA(input: {
  descricaoExercicio: string;
  respostaAluno: string;
}) {
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

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY nao configurada no servidor.");
  }

  const model = process.env.GROQ_CORRECTION_MODEL?.trim()
    || process.env.GROQ_MODEL?.trim();
  if (!model) {
    throw new Error("GROQ_CORRECTION_MODEL ou GROQ_MODEL nao configurado no servidor.");
  }

  const useStrictStructuredOutputs = model === "openai/gpt-oss-20b" || model === "openai/gpt-oss-120b";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

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
        temperature: 0.2,
        max_completion_tokens: 250,
        response_format: useStrictStructuredOutputs
          ? {
            type: "json_schema",
            json_schema: groqWrittenCorrectionJsonSchema,
          }
          : {
            type: "json_object",
          },
        messages: [
          {
            role: "system",
            content:
              "Voce corrige respostas escritas de alunos em portugues do Brasil. Compare somente a resposta com o enunciado da atividade. A nota deve ir de 0 a 100. Avalie aderencia ao pedido, corretude, completude e clareza. Nao penalize detalhes de ortografia quando a ideia principal estiver correta. O feedback deve ser curto, objetivo, util para o aluno, sem markdown e com no maximo 3 frases.",
          },
          {
            role: "user",
            content: [
              `Enunciado da atividade: ${input.descricaoExercicio}`,
              `Resposta do aluno: ${input.respostaAluno}`,
              "Retorne apenas JSON com nota inteira e feedback.",
            ].join("\n\n"),
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
            ?? "Erro ao corrigir resposta escrita com IA.")
          : "Erro ao corrigir resposta escrita com IA.";
      throw new Error(message);
    }

    const rawContent = payload?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string" || rawContent.trim().length === 0) {
      throw new Error("Groq nao retornou uma correcao valida.");
    }

    const parsed = aiWrittenCorrectionResponseSchema.parse(JSON.parse(rawContent));
    return {
      nota: parsed.nota,
      feedback: parsed.feedback.trim(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function validarMultiplaEscolhaCompleta(resposta: string, multipla_regras: string): { completa: boolean; mensagem?: string } {
  try {
    const respostaObj = JSON.parse(resposta);
    const regrasObj = JSON.parse(multipla_regras);
    const questoes = Array.isArray(regrasObj?.questoes)
      ? regrasObj.questoes
      : Array.isArray(regrasObj?.Questoes)
        ? regrasObj.Questoes
        : null;

    if (!questoes) {
      return { completa: false, mensagem: "Formato de regras invalido" };
    }

    const numQuestoes = questoes.length;
    for (let i = 0; i < numQuestoes; i++) {
      if (!respostaObj[`q${i}`]) {
        return {
          completa: false,
          mensagem: `Responda todas as ${numQuestoes} questoes antes de enviar.`
        };
      }
    }

    return { completa: true };
  } catch (error) {
    console.error("Erro ao validar multipla escolha:", error);
    return { completa: false, mensagem: "Formato de resposta invalido" };
  }
}

function validarMultiplaEscolha(resposta: string, multipla_regras: string): number {
  try {
    const respostaObj = JSON.parse(resposta);
    const regrasObj = JSON.parse(multipla_regras);
    const questoes = Array.isArray(regrasObj?.questoes)
      ? regrasObj.questoes
      : Array.isArray(regrasObj?.Questoes)
        ? regrasObj.Questoes
        : null;

    if (!questoes) {
      return 0;
    }

    let acertos = 0;
    questoes.forEach((questao: any, index: number) => {
      const respostaAluno = respostaObj[`q${index}`];
      if (respostaAluno === questao.respostaCorreta) {
        acertos++;
      }
    });

    return Math.round((acertos / questoes.length) * 100);
  } catch (error) {
    console.error("Erro ao validar multipla escolha:", error);
    return 0;
  }
}

export function submissoesRouter(jwtSecret: string) {
  const router = Router();

  // POST /exercicios/:exercicioId/submissoes - Enviar resposta
  router.post(
    "/exercicios/:exercicioId/submissoes",
    authGuard(jwtSecret),
    upload.single("arquivo"),
    async (req: AuthRequest, res) => {
      const { exercicioId } = req.params;
      const alunoId = req.user?.sub;

      if (!alunoId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const parsed = createSubmissaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { resposta, tipo_resposta, linguagem } = parsed.data;
      const respostaTexto = (resposta ?? "").toString().trim();
      const hasFile = !!req.file;
      if (!hasFile && respostaTexto.length === 0) {
        return res.status(400).json({
          message: "Resposta ou arquivo é obrigatório",
        });
      }

      try {

        const oldAlunoTurma = await hasAlunoTurmaTable();
        // Verificar se exercício existe e buscar prazo
        const userRole = req.user?.role;
        const params: any[] = [exercicioId];
        let query = `SELECT id, descricao, gabarito, tipo_exercicio, prazo, multipla_regras, permitir_repeticao,
          max_tentativas, penalidade_por_tentativa, intervalo_reenvio
          FROM exercicios e
          WHERE e.id = $1 AND e.publicado = true AND (e.published_at IS NULL OR e.published_at <= NOW())`;

        if (userRole === 1) {
          const alunoParam = `$${params.length + 1}`;
          params.push(alunoId);
          query += ` AND (
            EXISTS (
              SELECT 1 FROM exercicio_aluno ea
              WHERE ea.exercicio_id = e.id AND ea.aluno_id = ${alunoParam}
            )
            OR (
              NOT EXISTS (SELECT 1 FROM exercicio_aluno ea2 WHERE ea2.exercicio_id = e.id)
              AND (
                EXISTS (
                  SELECT 1 FROM exercicio_turma et
                  WHERE et.exercicio_id = e.id
                    AND et.turma_id IN (
                      SELECT ${oldAlunoTurma ? "turma_id" : "class_id"}
                      FROM ${oldAlunoTurma ? "aluno_turma" : "enrollment"}
                      WHERE ${oldAlunoTurma ? "aluno_id" : "user_id"} = ${alunoParam}
                    )
                )
                OR NOT EXISTS (SELECT 1 FROM exercicio_turma et2 WHERE et2.exercicio_id = e.id)
              )
            )
          )`;
        }

        const exercicio = await pool.query(query, params);

        if (exercicio.rows.length === 0) {
          return res.status(404).json({ message: "Exercício não encontrado" });
        }

        const exRow = exercicio.rows[0];
        const gabarito = exRow.gabarito;
        const multiplaRegras = exRow.multipla_regras;
        const descricaoExercicio = exRow.descricao ?? "";
        const prazo = exRow.prazo ? new Date(exRow.prazo) : null;
        const agora = new Date();
        const isLate = prazo && agora > prazo;

        // Bloquear submissão se o prazo expirou
        if (prazo && agora >= prazo) {
          return res.status(400).json({
            message: "O prazo para submissão deste exercício já expirou. Não é mais possível enviar respostas."
          });
        }

        const permitirRepeticao = exRow.permitir_repeticao ?? false;
        const maxTentativas = exRow.max_tentativas ?? null;
        const penalidadeTentativa = Number(exRow.penalidade_por_tentativa ?? 0);
        const intervaloReenvio = exRow.intervalo_reenvio ?? null;

        const attemptStats = await pool.query(
          `SELECT COUNT(*)::int as total, MAX(created_at) as last_at
           FROM submissoes
           WHERE exercicio_id = $1 AND aluno_id = $2`,
          [exercicioId, alunoId]
        );
        const tentativasAnteriores = attemptStats.rows[0]?.total ?? 0;
        const lastAt = attemptStats.rows[0]?.last_at ? new Date(attemptStats.rows[0].last_at) : null;

        if (!permitirRepeticao && tentativasAnteriores > 0) {
          return res.status(400).json({
            message: "Você já enviou uma resposta para este exercício."
          });
        }

        if (permitirRepeticao && maxTentativas !== null && tentativasAnteriores >= maxTentativas) {
          return res.status(400).json({
            message: "Limite de tentativas atingido para este exercício."
          });
        }

        if (permitirRepeticao && intervaloReenvio !== null && lastAt) {
          const diffMs = agora.getTime() - lastAt.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          if (diffMin < intervaloReenvio) {
            const restante = intervaloReenvio - diffMin;
            return res.status(400).json({
              message: `Aguarde ${restante} minuto(s) para enviar outra resposta.`
            });
          }
        }

        const respostaStr = (resposta ?? "").toString();

        // Validar múltipla escolha completude
        if (multiplaRegras) {
          const validacao = validarMultiplaEscolhaCompleta(respostaStr, multiplaRegras);
          if (!validacao.completa) {
            return res.status(400).json({
              message: validacao.mensagem || "Responda todas as questões antes de enviar."
            });
          }
        }

        // Detectar tipo de exercício e validar
        const tipoExercicio = exRow.tipo_exercicio;
        let notaAuto: number | null = null;
        let feedbackAuto: string | null = null;
        let corrigidaAuto = false;
        if (tipoExercicio === "atalho") {
          // Atalhos completados = 100% sempre
          notaAuto = 100;
          corrigidaAuto = true;
        } else if (multiplaRegras) {
          // Múltipla escolha - validação automática
          notaAuto = validarMultiplaEscolha(respostaStr, multiplaRegras);
          corrigidaAuto = true;
        } else if (tipo_resposta === "texto" && respostaTexto.length > 0) {
          try {
            const correcaoIA = await corrigirRespostaEscritaComIA({
              descricaoExercicio,
              respostaAluno: respostaTexto,
            });
            notaAuto = correcaoIA.nota;
            feedbackAuto = correcaoIA.feedback;
            corrigidaAuto = true;
          } catch (aiError) {
            console.error("Erro ao corrigir resposta escrita com IA:", aiError);
          }
        } else if (gabarito) {
          // Mantem validacao por gabarito apenas para respostas de codigo legadas
          notaAuto = corrigirAutomaticamente(respostaStr, gabarito, tipo_resposta);
          corrigidaAuto = notaAuto !== null;
        }
        if (notaAuto !== null && penalidadeTentativa > 0 && tentativasAnteriores > 0) {
          const fator = 1 - (penalidadeTentativa * tentativasAnteriores) / 100;
          notaAuto = Math.max(0, Math.round(notaAuto * Math.max(fator, 0)));
        }
        const verificacaoDescricao = tipoExercicio === "atalho" ? 100 : calcularScoreAderencia(respostaStr, tipo_resposta, descricaoExercicio, gabarito);

        let arquivoUrl: string | null = null;
        let arquivoNome: string | null = null;
        if (req.file) {
          arquivoNome = req.file.originalname;
          arquivoUrl = await uploadToR2(req.file, "submissoes");
        }

        const respostaFinal = respostaStr.trim().length > 0 ? respostaStr : null;

        // Inserir submissão
        const result = await pool.query<SubmissaoRow>(
          `INSERT INTO submissoes (exercicio_id, aluno_id, resposta, tipo_resposta, linguagem, nota, corrigida, feedback_professor, is_late, arquivo_url, arquivo_nome)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            exercicioId,
            alunoId,
            respostaFinal,
            tipo_resposta,
            linguagem ?? null,
            notaAuto,
            corrigidaAuto,
            feedbackAuto,
            isLate ?? false, // marcar como atrasada se passou do prazo
            arquivoUrl,
            arquivoNome,
          ]
        );

        const submissao = result.rows[0];

        return res.status(201).json({
          message: isLate ? "Submissão enviada com sucesso (atrasada)" : "Submissão enviada com sucesso!",
          submissao: mapSubmissaoRow(submissao),
        });
      } catch (error) {
        console.error("Erro ao criar submissão:", error);
        return res.status(500).json({ message: "Erro ao criar submissão" });
      }
    }
  );

  // GET /exercicios/:exercicioId/minhas-submissoes - Ver minhas tentativas
  router.get(
    "/exercicios/:exercicioId/minhas-submissoes",
    authGuard(jwtSecret),
    async (req: AuthRequest, res) => {
      const exercicioId = getSingleRouteParam(req.params.exercicioId);
      const alunoId = req.user?.sub;

      if (!exercicioId) {
        return res.status(400).json({ message: "Exercicio invalido" });
      }

      if (!alunoId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      try {
        const schema = await getExerciseSchemaInfo();
        const useNewSchema = schema.hasExercise && !schema.hasExercicios;
        const answerKeyCol = schema.exerciseAnswerKeyColumn;

        const query = useNewSchema
          ? `SELECT s.*,
               e.description AS exercicio_descricao,
               ${answerKeyCol ? `e.${answerKeyCol}` : "NULL::text"} AS exercicio_gabarito
             FROM submissoes s
             JOIN exercise e ON s.exercicio_id = e.id
             WHERE s.exercicio_id = $1 AND s.aluno_id = $2
             ORDER BY s.created_at DESC`
          : `SELECT s.*, e.descricao as exercicio_descricao, e.gabarito as exercicio_gabarito
             FROM submissoes s
             JOIN exercicios e ON s.exercicio_id = e.id
             WHERE s.exercicio_id = $1 AND s.aluno_id = $2
             ORDER BY s.created_at DESC`;

        const result = await pool.query<SubmissaoRow & { exercicio_descricao: string; exercicio_gabarito: string | null }>(
          query,
          [exercicioId, alunoId]
        );

        return res.json(
          result.rows.map((row) => ({
            ...mapSubmissaoRow(row),
            verificacaoDescricao: calcularScoreAderencia(row.resposta, row.tipo_resposta, row.exercicio_descricao, row.exercicio_gabarito),
          }))
        );
      } catch (error) {
        console.error("Erro ao buscar submissões:", error);
        return res.status(500).json({ message: "Erro ao buscar submissões" });
      }
    }
  );

  // GET /minhas-submissoes - Ver todas as minhas submissões
  router.get("/minhas-submissoes", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const alunoId = req.user?.sub;

    if (!alunoId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    try {
      const schema = await getExerciseSchemaInfo();
      const useNewSchema = schema.hasExercise && !schema.hasExercicios;
      const answerKeyCol = schema.exerciseAnswerKeyColumn;

      const query = useNewSchema
        ? `SELECT s.*,
             e.title AS exercicio_titulo,
             m.name AS exercicio_modulo,
             e.description AS exercicio_descricao,
             ${answerKeyCol ? `e.${answerKeyCol}` : "NULL::text"} AS exercicio_gabarito
           FROM submissoes s
           JOIN exercise e ON s.exercicio_id = e.id
           LEFT JOIN phase p ON p.id = e.phase_id
           LEFT JOIN module m ON m.id = p.module_id
           WHERE s.aluno_id = $1
           ORDER BY s.created_at DESC`
        : `SELECT s.*,
             e.titulo AS exercicio_titulo,
             e.modulo AS exercicio_modulo,
             e.descricao AS exercicio_descricao,
             e.gabarito AS exercicio_gabarito
           FROM submissoes s
           JOIN exercicios e ON s.exercicio_id = e.id
           WHERE s.aluno_id = $1
           ORDER BY s.created_at DESC`;

      const result = await pool.query<
        SubmissaoRow & {
          exercicio_titulo: string;
          exercicio_modulo: string;
          exercicio_descricao: string;
          exercicio_gabarito: string | null;
        }
      >(query, [alunoId]);

      return res.json(
        result.rows.map((row) => ({
          id: row.id,
          exercicioId: row.exercicio_id,
          exercicioTitulo: row.exercicio_titulo,
          exercicioModulo: row.exercicio_modulo,
          alunoId: row.aluno_id,
          resposta: row.resposta,
          tipoResposta: row.tipo_resposta,
          linguagem: row.linguagem,
          nota: parseNotaToNumber(row.nota),
          corrigida: row.corrigida,
          feedbackProfessor: row.feedback_professor,
          arquivoUrl: row.arquivo_url,
          arquivoNome: row.arquivo_nome,
          verificacaoDescricao: calcularScoreAderencia(row.resposta, row.tipo_resposta, row.exercicio_descricao, row.exercicio_gabarito),
          createdAt: row.created_at,
        }))
      );
    } catch (error) {
      console.error("Erro ao buscar submissões:", error);
      return res.status(500).json({ message: "Erro ao buscar submissões" });
    }
  });

  // GET /exercicios/:exercicioId/submissoes - Listar submissões (admin/professor)
  router.get(
    "/exercicios/:exercicioId/submissoes",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const exercicioId = getSingleRouteParam(req.params.exercicioId);

      try {
        if (!exercicioId) {
          return res.status(400).json({ message: "Exercicio invalido" });
        }

        const result = await pool.query<
          SubmissaoRow & {
            usuario: string;
            nome_aluno: string;
            exercicio_descricao: string;
            exercicio_gabarito: string | null;
          }
        >(
          `SELECT s.*, u.usuario, u.nome as nome_aluno, e.descricao as exercicio_descricao, e.gabarito as exercicio_gabarito
           FROM submissoes s
           JOIN users u ON s.aluno_id = u.id
           JOIN exercicios e ON s.exercicio_id = e.id
           WHERE s.exercicio_id = $1
           ORDER BY s.created_at DESC`,
          [exercicioId]
        );

        return res.json(
          result.rows.map((row) => ({
            id: row.id,
            exercicioId: row.exercicio_id,
            alunoId: row.aluno_id,
            alunoUsuario: row.usuario,
            alunoNome: row.nome_aluno,
            resposta: row.resposta,
            tipoResposta: row.tipo_resposta,
            linguagem: row.linguagem,
            nota: parseNotaToNumber(row.nota),
            corrigida: row.corrigida,
            feedbackProfessor: row.feedback_professor,
            arquivoUrl: row.arquivo_url,
            arquivoNome: row.arquivo_nome,
            verificacaoDescricao: calcularScoreAderencia(row.resposta, row.tipo_resposta, row.exercicio_descricao, row.exercicio_gabarito),
            createdAt: row.created_at,
          }))
        );
      } catch (error) {
        console.error("Erro ao buscar submissões:", error);
        return res.status(500).json({ message: "Erro ao buscar submissões" });
      }
    }
  );

  // PUT /submissoes/:submissaoId/corrigir - Corrigir submissão (admin/professor)
  router.put(
    "/submissoes/:submissaoId/corrigir",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { submissaoId } = req.params;

      const parsed = corrigirSubmissaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { nota, feedback } = parsed.data;

      try {
        const result = await pool.query<SubmissaoRow>(
          `UPDATE submissoes
           SET nota = $1, feedback_professor = $2, corrigida = true, updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [nota, feedback ?? null, submissaoId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ message: "Submissão não encontrada" });
        }

        const submissao = result.rows[0];

        return res.json({
          message: "Submissão corrigida com sucesso!",
          submissao: mapSubmissaoRow(submissao),
        });
      } catch (error) {
        console.error("Erro ao corrigir submissão:", error);
        return res.status(500).json({ message: "Erro ao corrigir submissão" });
      }
    }
  );

  // GET /exercicios/:exercicioId/answer-students - Lista alunos que já responderam
  router.get(
    "/exercicios/:exercicioId/answer-students",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const exercicioId = Number(req.params.exercicioId);
      if (!Number.isFinite(exercicioId)) {
        return res.status(400).json({ message: "ID de exercício inválido" });
      }

      try {
        const result = await pool.query<{
          aluno_id: number;
          aluno_nome: string;
          aluno_email: string;
          total_answers: number;
          last_answered_at: string | null;
        }>(
          `SELECT
             u.id AS aluno_id,
             u.name AS aluno_nome,
             u.email AS aluno_email,
             COUNT(*)::int AS total_answers,
             MAX(a.answered_at) AS last_answered_at
           FROM answer a
           JOIN "user" u ON u.id = a.user_id
           WHERE a.exercise_id = $1
           GROUP BY u.id, u.name, u.email
           ORDER BY u.name ASC`,
          [exercicioId]
        );

        return res.json({
          exercicioId,
          totalAlunos: result.rows.length,
          alunos: result.rows.map((row) => ({
            alunoId: row.aluno_id,
            alunoNome: row.aluno_nome,
            alunoEmail: row.aluno_email,
            totalAnswers: row.total_answers,
            lastAnsweredAt: row.last_answered_at,
          })),
        });
      } catch (error) {
        console.error("Erro ao buscar alunos com respostas:", error);
        return res.status(500).json({ message: "Erro ao buscar alunos com respostas" });
      }
    }
  );

  // GET /answers/students - Lista todos os alunos que já responderam (tabela answer)
  router.get(
    "/answers/students",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      try {
        const page = Math.max(1, Number(req.query.page ?? 1) || 1);
        const limitRaw = Math.max(1, Number(req.query.limit ?? 12) || 12);
        const limit = Math.min(100, limitRaw);
        const offset = (page - 1) * limit;
        const q = String(req.query.q ?? "").trim();

        const params: any[] = [];
        const where: string[] = ["1=1"];
        if (q) {
          params.push(`%${q}%`);
          const p = `$${params.length}`;
          where.push(`(u.name ILIKE ${p} OR u.email ILIKE ${p})`);
        }

        const countResult = await pool.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total
           FROM (
             SELECT u.id
             FROM answer a
             JOIN "user" u ON u.id = a.user_id
             WHERE ${where.join(" AND ")}
             GROUP BY u.id
           ) x`,
          params
        );

        const listParams = [...params, limit, offset];
        const result = await pool.query<{
          aluno_id: number;
          aluno_nome: string;
          aluno_email: string;
          total_answers: number;
          total_exercicios: number;
          last_answered_at: string | null;
        }>(
          `SELECT
             u.id AS aluno_id,
             u.name AS aluno_nome,
             u.email AS aluno_email,
             COUNT(*)::int AS total_answers,
             COUNT(DISTINCT a.exercise_id)::int AS total_exercicios,
             MAX(a.answered_at) AS last_answered_at
           FROM answer a
           JOIN "user" u ON u.id = a.user_id
           WHERE ${where.join(" AND ")}
           GROUP BY u.id, u.name, u.email
           ORDER BY u.name ASC
           LIMIT $${listParams.length - 1}
           OFFSET $${listParams.length}`,
          listParams
        );

        const total = countResult.rows[0]?.total ?? 0;

        return res.json({
          totalAlunos: total,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
          alunos: result.rows.map((row) => ({
            alunoId: row.aluno_id,
            alunoNome: row.aluno_nome,
            alunoEmail: row.aluno_email,
            totalAnswers: row.total_answers,
            totalExercicios: row.total_exercicios,
            lastAnsweredAt: row.last_answered_at,
          })),
        });
      } catch (error) {
        console.error("Erro ao buscar todos os alunos com respostas:", error);
        return res.status(500).json({ message: "Erro ao buscar todos os alunos com respostas" });
      }
    }
  );

  // GET /answers/students/:alunoId/exercises - Lista exercícios já respondidos por um aluno (tabela answer)
  router.get(
    "/answers/students/:alunoId/exercises",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const alunoId = Number(req.params.alunoId);
      if (!Number.isFinite(alunoId)) {
        return res.status(400).json({ message: "ID de aluno inválido" });
      }

      try {
        const page = Math.max(1, Number(req.query.page ?? 1) || 1);
        const limitRaw = Math.max(1, Number(req.query.limit ?? 8) || 8);
        const limit = Math.min(100, limitRaw);
        const offset = (page - 1) * limit;
        const q = String(req.query.q ?? "").trim();

        const params: any[] = [alunoId];
        const where: string[] = ["a.user_id = $1"];
        if (q) {
          params.push(`%${q}%`);
          const p = `$${params.length}`;
          where.push(`(
            COALESCE(e.title, '') ILIKE ${p}
            OR COALESCE(m.name, '') ILIKE ${p}
            OR COALESCE(p.name, '') ILIKE ${p}
            OR CAST(a.exercise_id AS TEXT) ILIKE ${p}
          )`);
        }

        const countResult = await pool.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total
           FROM (
             SELECT a.exercise_id
             FROM answer a
             LEFT JOIN exercise e ON e.id = a.exercise_id
             LEFT JOIN phase p ON p.id = e.phase_id
             LEFT JOIN module m ON m.id = p.module_id
             WHERE ${where.join(" AND ")}
             GROUP BY a.exercise_id
           ) x`,
          params
        );

        const listParams = [...params, limit, offset];
        const result = await pool.query<{
          exercicio_id: number;
          exercicio_titulo: string | null;
          exercicio_modulo: string | null;
          exercicio_tema: string | null;
          total_answers: number;
          last_answered_at: string | null;
        }>(
          `SELECT
             a.exercise_id AS exercicio_id,
             e.title AS exercicio_titulo,
             m.name AS exercicio_modulo,
             p.name AS exercicio_tema,
             COUNT(*)::int AS total_answers,
             MAX(a.answered_at) AS last_answered_at
           FROM answer a
           LEFT JOIN exercise e ON e.id = a.exercise_id
           LEFT JOIN phase p ON p.id = e.phase_id
           LEFT JOIN module m ON m.id = p.module_id
           WHERE ${where.join(" AND ")}
           GROUP BY a.exercise_id, e.title, m.name, p.name
           ORDER BY MAX(a.answered_at) DESC NULLS LAST, a.exercise_id DESC
           LIMIT $${listParams.length - 1}
           OFFSET $${listParams.length}`,
          listParams
        );

        const total = countResult.rows[0]?.total ?? 0;

        return res.json({
          alunoId,
          totalExercicios: total,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
          exercicios: result.rows.map((row) => ({
            exercicioId: row.exercicio_id,
            exercicioTitulo: row.exercicio_titulo ?? `Exercício #${row.exercicio_id}`,
            exercicioModulo: row.exercicio_modulo,
            exercicioTema: row.exercicio_tema,
            totalAnswers: row.total_answers,
            lastAnsweredAt: row.last_answered_at,
          })),
        });
      } catch (error) {
        console.error("Erro ao buscar exercícios respondidos por aluno:", error);
        return res.status(500).json({ message: "Erro ao buscar exercícios respondidos por aluno" });
      }
    }
  );

  // GET /exercicios/:exercicioId/answers - Lista respostas agrupadas por aluno (schema novo)
  router.get(
    "/exercicios/:exercicioId/answers",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const exercicioId = Number(req.params.exercicioId);
      if (!Number.isFinite(exercicioId)) {
        return res.status(400).json({ message: "ID de exercício inválido" });
      }

      try {
        const page = Math.max(1, Number(req.query.page ?? 1) || 1);
        const limitRaw = Math.max(1, Number(req.query.limit ?? 20) || 20);
        const limit = Math.min(200, limitRaw);
        const offset = (page - 1) * limit;
        const q = String(req.query.q ?? "").trim();
        const alunoId = Number(req.query.alunoId ?? 0) || null;
        const status = String(req.query.status ?? "todos") as "todos" | "corrigida" | "pendente";
        const dateFromRaw = String(req.query.dateFrom ?? "").trim();
        const dateToRaw = String(req.query.dateTo ?? "").trim();
        const sort = String(req.query.sort ?? "recent") as "recent" | "oldest" | "student";

        const params: any[] = [exercicioId];
        const where: string[] = ["a.exercise_id = $1"];

        if (alunoId) {
          params.push(alunoId);
          where.push(`u.id = $${params.length}`);
        }
        if (status === "corrigida") where.push("a.is_correct IS NOT NULL");
        if (status === "pendente") where.push("a.is_correct IS NULL");
        if (q) {
          params.push(`%${q}%`);
          const p = `$${params.length}`;
          where.push(`(
            u.name ILIKE ${p}
            OR u.email ILIKE ${p}
            OR q.statement ILIKE ${p}
            OR COALESCE(a.answer_text,'') ILIKE ${p}
            OR COALESCE(a.feedback,'') ILIKE ${p}
            OR CAST(a.id AS TEXT) ILIKE ${p}
          )`);
        }
        if (dateFromRaw) {
          params.push(dateFromRaw);
          where.push(`a.answered_at >= $${params.length}::timestamptz`);
        }
        if (dateToRaw) {
          params.push(dateToRaw);
          where.push(`a.answered_at <= $${params.length}::timestamptz`);
        }

        const orderBy =
          sort === "oldest"
            ? "a.answered_at ASC NULLS LAST, a.id ASC"
            : sort === "student"
              ? "u.name ASC, q.id ASC"
              : "a.answered_at DESC NULLS LAST, a.id DESC";

        const countResult = await pool.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total
           FROM answer a
           JOIN "user" u ON u.id = a.user_id
           JOIN question q ON q.id = a.question_id
           WHERE ${where.join(" AND ")}`,
          params
        );

        const rows = await pool.query<{
          answer_id: number;
          aluno_id: number;
          aluno_nome: string;
          aluno_email: string;
          question_id: number;
          question_statement: string;
          options: Array<{ id: number; text: string; isCorrect: boolean; position: number }> | null;
          answer_text: string | null;
          selected_option: number | null;
          is_correct: boolean | null;
          feedback: string | null;
          answered_at: string | null;
        }>(
          `SELECT
             a.id AS answer_id,
             u.id AS aluno_id,
             u.name AS aluno_nome,
             u.email AS aluno_email,
             q.id AS question_id,
             q.statement AS question_statement,
             COALESCE((
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', qq.id,
                   'text', qq.option_text,
                   'isCorrect', qq.is_correct,
                   'position', qq.position
                 )
                 ORDER BY qq.position ASC
               )
               FROM (
                 SELECT
                   qo.id,
                   qo.option_text,
                   qo.is_correct,
                   ROW_NUMBER() OVER (ORDER BY qo.id ASC) AS position
                 FROM question_option qo
                 WHERE qo.question_id = q.id
               ) qq
             ), '[]'::jsonb) AS options,
             a.answer_text,
             a.selected_option,
             a.is_correct,
             a.feedback,
             a.answered_at
           FROM answer a
           JOIN "user" u ON u.id = a.user_id
           JOIN question q ON q.id = a.question_id
           WHERE ${where.join(" AND ")}
           ORDER BY ${orderBy}
           LIMIT ${limit}
           OFFSET ${offset}`,
          params
        );

        const stats = await pool.query<{
          total_answers: number;
          total_alunos: number;
          corrigidas: number;
          pendentes: number;
          corretas: number;
          incorretas: number;
        }>(
          `SELECT
             COUNT(*)::int AS total_answers,
             COUNT(DISTINCT u.id)::int AS total_alunos,
             COUNT(*) FILTER (WHERE a.is_correct IS NOT NULL)::int AS corrigidas,
             COUNT(*) FILTER (WHERE a.is_correct IS NULL)::int AS pendentes,
             COUNT(*) FILTER (WHERE a.is_correct = true)::int AS corretas,
             COUNT(*) FILTER (WHERE a.is_correct = false)::int AS incorretas
           FROM answer a
           JOIN "user" u ON u.id = a.user_id
           JOIN question q ON q.id = a.question_id
           WHERE ${where.join(" AND ")}`,
          params
        );

        const byAluno = new Map<number, {
          alunoId: number;
          alunoNome: string;
          alunoEmail: string;
          answers: Array<{
            id: number;
            questionId: number;
            question: string;
            options: Array<{ id: number; text: string; isCorrect: boolean; position: number }>;
            answerText: string | null;
            selectedOption: number | null;
            isCorrect: boolean | null;
            feedback: string | null;
            answeredAt: string | null;
          }>;
        }>();

        for (const r of rows.rows) {
          if (!byAluno.has(r.aluno_id)) {
            byAluno.set(r.aluno_id, {
              alunoId: r.aluno_id,
              alunoNome: r.aluno_nome,
              alunoEmail: r.aluno_email,
              answers: [],
            });
          }
          byAluno.get(r.aluno_id)!.answers.push({
            id: r.answer_id,
            questionId: r.question_id,
            question: r.question_statement,
            options: r.options ?? [],
            answerText: r.answer_text,
            selectedOption: r.selected_option,
            isCorrect: r.is_correct,
            feedback: r.feedback,
            answeredAt: r.answered_at,
          });
        }

        const totals = stats.rows[0] ?? {
          total_answers: 0,
          total_alunos: 0,
          corrigidas: 0,
          pendentes: 0,
          corretas: 0,
          incorretas: 0,
        };

        return res.json({
          exercicioId,
          pagination: {
            page,
            limit,
            total: countResult.rows[0]?.total ?? 0,
            totalPages: Math.max(1, Math.ceil((countResult.rows[0]?.total ?? 0) / limit)),
          },
          stats: {
            totalAlunos: totals.total_alunos,
            totalAnswers: totals.total_answers,
            corrigidas: totals.corrigidas,
            pendentes: totals.pendentes,
            corretas: totals.corretas,
            incorretas: totals.incorretas,
          },
          totalAlunos: totals.total_alunos,
          totalAnswers: totals.total_answers,
          alunos: Array.from(byAluno.values()),
        });
      } catch (error) {
        console.error("Erro ao buscar answers:", error);
        return res.status(500).json({ message: "Erro ao buscar answers" });
      }
    }
  );

  async function updateOneAnswer(answerId: number, data: z.infer<typeof updateAnswerSchema>, req: AuthRequest) {
    const sets: string[] = [];
    const params: any[] = [];

    if (Object.prototype.hasOwnProperty.call(data, "answer_text")) {
      params.push(data.answer_text ?? null);
      sets.push(`answer_text = $${params.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(data, "selected_option")) {
      params.push(data.selected_option ?? null);
      sets.push(`selected_option = $${params.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(data, "is_correct")) {
      params.push(data.is_correct ?? null);
      sets.push(`is_correct = $${params.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(data, "feedback")) {
      params.push(data.feedback ?? null);
      sets.push(`feedback = $${params.length}`);
    }
    if (sets.length === 0) return null;

    const oldRow = await pool.query<{
      id: number;
      user_id: number;
      question_id: number;
      exercise_id: number;
      answer_text: string | null;
      selected_option: number | null;
      is_correct: boolean | null;
      feedback: string | null;
      answered_at: string | null;
    }>(
      `SELECT id, user_id, question_id, exercise_id, answer_text, selected_option, is_correct, feedback, answered_at
       FROM answer WHERE id = $1`,
      [answerId]
    );
    if (!oldRow.rows[0]) return { notFound: true as const };

    params.push(answerId);
    const updated = await pool.query<{
      id: number;
      user_id: number;
      question_id: number;
      exercise_id: number;
      answer_text: string | null;
      selected_option: number | null;
      is_correct: boolean | null;
      feedback: string | null;
      answered_at: string | null;
    }>(
      `UPDATE answer
       SET ${sets.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, user_id, question_id, exercise_id, answer_text, selected_option, is_correct, feedback, answered_at`,
      params
    );

    const row = updated.rows[0];
    await logActivity({
      actor: { id: req.user?.sub ?? null, role: req.user?.role ?? null },
      action: "update_answer",
      entityType: "answer",
      entityId: String(row.id),
      metadata: {
        before: oldRow.rows[0],
        after: row,
      },
      req,
    });
    return { row };
  }

  // PUT /answers/batch - Atualiza várias respostas de uma vez
  router.put(
    "/answers/batch",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const parsed = batchUpdateAnswersSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { answer_ids, patch } = parsed.data;
      if (
        !Object.prototype.hasOwnProperty.call(patch, "answer_text") &&
        !Object.prototype.hasOwnProperty.call(patch, "selected_option") &&
        !Object.prototype.hasOwnProperty.call(patch, "is_correct") &&
        !Object.prototype.hasOwnProperty.call(patch, "feedback")
      ) {
        return res.status(400).json({ message: "Nada para atualizar no patch" });
      }

      try {
        const updatedIds: number[] = [];
        const notFoundIds: number[] = [];
        for (const answerId of Array.from(new Set(answer_ids))) {
          const updated = await updateOneAnswer(answerId, patch, req);
          if (!updated || "notFound" in updated) {
            notFoundIds.push(answerId);
            continue;
          }
          updatedIds.push(updated.row.id);
        }

        return res.json({
          message: "Atualização em lote concluída",
          updatedCount: updatedIds.length,
          updatedIds,
          notFoundCount: notFoundIds.length,
          notFoundIds,
        });
      } catch (error) {
        console.error("Erro ao atualizar answers em lote:", error);
        return res.status(500).json({ message: "Erro ao atualizar answers em lote" });
      }
    }
  );

  // PUT /answers/:answerId - Atualiza resposta específica por ID (schema novo)
  router.put(
    "/answers/:answerId",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const answerId = Number(req.params.answerId);
      if (!Number.isFinite(answerId)) {
        return res.status(400).json({ message: "ID de answer inválido" });
      }

      const parsed = updateAnswerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const data = parsed.data;
      if (
        !Object.prototype.hasOwnProperty.call(data, "answer_text") &&
        !Object.prototype.hasOwnProperty.call(data, "selected_option") &&
        !Object.prototype.hasOwnProperty.call(data, "is_correct") &&
        !Object.prototype.hasOwnProperty.call(data, "feedback")
      ) {
        return res.status(400).json({ message: "Nada para atualizar" });
      }

      try {
        const updated = await updateOneAnswer(answerId, data, req);
        if (!updated || "notFound" in updated) {
          return res.status(404).json({ message: "Answer não encontrado" });
        }

        const row = updated.row;
        return res.json({
          message: "Answer atualizado com sucesso",
          answer: {
            id: row.id,
            userId: row.user_id,
            questionId: row.question_id,
            exerciseId: row.exercise_id,
            answerText: row.answer_text,
            selectedOption: row.selected_option,
            isCorrect: row.is_correct,
            feedback: row.feedback,
            answeredAt: row.answered_at,
          },
        });
      } catch (error) {
        console.error("Erro ao atualizar answer:", error);
        return res.status(500).json({ message: "Erro ao atualizar answer" });
      }
    }
  );

  return router;
}

