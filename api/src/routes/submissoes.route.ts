import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";
import { uploadToR2 } from "../utils/uploadR2";

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
    cb(new Error("Tipo de arquivo nÃ£o permitido"));
  },
});

type TipoResposta = "codigo" | "texto";

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
  if (gabarito) {
    if (tipo === "codigo") {
      const respostaLimpa = normalizarCodigo(resposta);
      const gabaritoLimpo = normalizarCodigo(gabarito);
      const similaridade = calcularSimilaridade(respostaLimpa, gabaritoLimpo);
      return Math.round(similaridade * 100);
    }

    const respostaNorm = normalizarTexto(resposta);
    const gabaritoNorm = normalizarTexto(gabarito);
    const similaridade = calcularSimilaridade(respostaNorm, gabaritoNorm);
    return Math.round(similaridade * 100);
  }

  if (tipo === "texto") {
    return calcularScoreDescricao(descricao, resposta);
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

  if (tipo === "texto") {
    const respostaNorm = normalizarTexto(resposta);
    const gabaritoNorm = normalizarTexto(gabarito);
    const similaridade = calcularSimilaridade(respostaNorm, gabaritoNorm);
    return Math.round(similaridade * 100);
  }

  if (tipo === "codigo") {
    const respostaLimpa = normalizarCodigo(resposta);
    const gabaritoLimpo = normalizarCodigo(gabarito);
    const similaridade = calcularSimilaridade(respostaLimpa, gabaritoLimpo);
    return Math.round(similaridade * 100);
  }

  return null;
}

function validarMultiplaEscolhaCompleta(resposta: string, multipla_regras: string): { completa: boolean; mensagem?: string } {
  try {
    const respostaObj = JSON.parse(resposta);
    const regrasObj = JSON.parse(multipla_regras);

    if (!regrasObj.questoes || !Array.isArray(regrasObj.questoes)) {
      return { completa: false, mensagem: "Formato de regras invÃ¡lido" };
    }

    const numQuestoes = regrasObj.questoes.length;
    for (let i = 0; i < numQuestoes; i++) {
      if (!respostaObj[`q${i}`]) {
        return {
          completa: false,
          mensagem: `Responda todas as ${numQuestoes} questÃµes antes de enviar.`
        };
      }
    }

    return { completa: true };
  } catch (error) {
    console.error("Erro ao validar mÃºltipla escolha:", error);
    return { completa: false, mensagem: "Formato de resposta invÃ¡lido" };
  }
}

function validarMultiplaEscolha(resposta: string, multipla_regras: string): number {
  try {
    const respostaObj = JSON.parse(resposta);
    const regrasObj = JSON.parse(multipla_regras);

    if (!regrasObj.questoes || !Array.isArray(regrasObj.questoes)) {
      return 0;
    }

    let acertos = 0;
    regrasObj.questoes.forEach((questao: any, index: number) => {
      const respostaAluno = respostaObj[`q${index}`];
      if (respostaAluno === questao.respostaCorreta) {
        acertos++;
      }
    });

    return Math.round((acertos / regrasObj.questoes.length) * 100);
  } catch (error) {
    console.error("Erro ao validar mÃºltipla escolha:", error);
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
        return res.status(401).json({ message: "UsuÃ¡rio nÃ£o autenticado" });
      }

      const parsed = createSubmissaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invÃ¡lidos",
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { resposta, tipo_resposta, linguagem } = parsed.data;
      const respostaTexto = (resposta ?? "").toString().trim();
      const hasFile = !!req.file;
      if (!hasFile && respostaTexto.length === 0) {
        return res.status(400).json({
          message: "Resposta ou arquivo ÃƒÂ© obrigatÃƒÂ³rio",
        });
      }

      try {
        // Verificar se exercÃ­cio existe e buscar prazo
        const userRole = req.user?.role;
        const params: any[] = [exercicioId];
        let query = `SELECT id, descricao, gabarito, tipo_exercicio, prazo, multipla_regras, permitir_repeticao,
          max_tentativas, penalidade_por_tentativa, intervalo_reenvio
          FROM exercicios e
          WHERE e.id = $1 AND e.publicado = true AND (e.published_at IS NULL OR e.published_at <= NOW())`;

        if (userRole === "aluno") {
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
                      SELECT turma_id FROM aluno_turma WHERE aluno_id = ${alunoParam}
                    )
                )
                OR NOT EXISTS (SELECT 1 FROM exercicio_turma et2 WHERE et2.exercicio_id = e.id)
              )
            )
          )`;
        }

        const exercicio = await pool.query(query, params);

        if (exercicio.rows.length === 0) {
          return res.status(404).json({ message: "ExercÃ­cio nÃ£o encontrado" });
        }

        const exRow = exercicio.rows[0];
        const gabarito = exRow.gabarito;
        const multiplaRegras = exRow.multipla_regras;
        const descricaoExercicio = exRow.descricao ?? "";
        const prazo = exRow.prazo ? new Date(exRow.prazo) : null;
        const agora = new Date();
        const isLate = prazo && agora > prazo;

        // Bloquear submissÃ£o se o prazo expirou
        if (prazo && agora >= prazo) {
          return res.status(400).json({
            message: "O prazo para submissÃ£o deste exercÃ­cio jÃ¡ expirou. NÃ£o Ã© mais possÃ­vel enviar respostas."
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
            message: "VocÃª jÃ¡ enviou uma resposta para este exercÃ­cio."
          });
        }

        if (permitirRepeticao && maxTentativas !== null && tentativasAnteriores >= maxTentativas) {
          return res.status(400).json({
            message: "Limite de tentativas atingido para este exercÃ­cio."
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

        // Validar mÃºltipla escolha completude
        if (multiplaRegras) {
          const validacao = validarMultiplaEscolhaCompleta(respostaStr, multiplaRegras);
          if (!validacao.completa) {
            return res.status(400).json({
              message: validacao.mensagem || "Responda todas as questÃµes antes de enviar."
            });
          }
        }

        // Detectar tipo de exercÃ­cio e validar
        const tipoExercicio = exRow.tipo_exercicio;
        let notaAuto = null;
        if (tipoExercicio === "atalho") {
          // Atalhos completados = 100% sempre
          notaAuto = 100;
        } else if (multiplaRegras) {
          // MÃºltipla escolha - validaÃ§Ã£o automÃ¡tica
          notaAuto = validarMultiplaEscolha(respostaStr, multiplaRegras);
        } else if (gabarito) {
          // ValidaÃ§Ã£o normal por gabarito
          notaAuto = corrigirAutomaticamente(respostaStr, gabarito, tipo_resposta);
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

        // Inserir submissÃ£o
        const result = await pool.query<SubmissaoRow>(
          `INSERT INTO submissoes (exercicio_id, aluno_id, resposta, tipo_resposta, linguagem, nota, corrigida, is_late, arquivo_url, arquivo_nome)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            exercicioId,
            alunoId,
            respostaFinal,
            tipo_resposta,
            linguagem ?? null,
            notaAuto, // nota automÃ¡tica se houver gabarito ou mÃºltipla escolha
            gabarito || multiplaRegras ? true : false, // marcar como corrigida se hÃ¡ gabarito ou mÃºltipla escolha
            isLate ?? false, // marcar como atrasada se passou do prazo
            arquivoUrl,
            arquivoNome,
          ]
        );

        const submissao = result.rows[0];

        return res.status(201).json({
          message: isLate ? "SubmissÃ£o enviada com sucesso (atrasada)" : "SubmissÃ£o enviada com sucesso!",
          submissao: {
            id: submissao.id,
            exercicioId: submissao.exercicio_id,
            alunoId: submissao.aluno_id,
            resposta: submissao.resposta,
            tipoResposta: submissao.tipo_resposta,
            linguagem: submissao.linguagem,
          nota: parseNotaToNumber(submissao.nota),
          corrigida: submissao.corrigida,
          feedbackProfessor: submissao.feedback_professor,
          isLate: submissao.is_late ?? false,
          arquivoUrl: submissao.arquivo_url,
          arquivoNome: submissao.arquivo_nome,
          createdAt: submissao.created_at,
        },
      });
      } catch (error) {
        console.error("Erro ao criar submissÃ£o:", error);
        return res.status(500).json({ message: "Erro ao criar submissÃ£o" });
      }
    }
  );

  // GET /exercicios/:exercicioId/minhas-submissoes - Ver minhas tentativas
  router.get(
    "/exercicios/:exercicioId/minhas-submissoes",
    authGuard(jwtSecret),
    async (req: AuthRequest, res) => {
      const { exercicioId } = req.params;
      const alunoId = req.user?.sub;

      if (!alunoId) {
        return res.status(401).json({ message: "UsuÃ¡rio nÃ£o autenticado" });
      }

      try {
        const result = await pool.query<SubmissaoRow & { exercicio_descricao: string; exercicio_gabarito: string | null }>(
          `SELECT s.*, e.descricao as exercicio_descricao, e.gabarito as exercicio_gabarito
           FROM submissoes s
           JOIN exercicios e ON s.exercicio_id = e.id
           WHERE s.exercicio_id = $1 AND s.aluno_id = $2
           ORDER BY s.created_at DESC`,
          [exercicioId, alunoId]
        );

        return res.json(
          result.rows.map((row) => ({
            id: row.id,
            exercicioId: row.exercicio_id,
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
        console.error("Erro ao buscar submissÃµes:", error);
        return res.status(500).json({ message: "Erro ao buscar submissÃµes" });
      }
    }
  );

  // GET /minhas-submissoes - Ver todas as minhas submissÃµes
  router.get("/minhas-submissoes", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const alunoId = req.user?.sub;

    if (!alunoId) {
      return res.status(401).json({ message: "UsuÃ¡rio nÃ£o autenticado" });
    }

    try {
      const result = await pool.query<
        SubmissaoRow & {
          exercicio_titulo: string;
          exercicio_modulo: string;
          exercicio_descricao: string;
          exercicio_gabarito: string | null;
        }
      >(
        `SELECT s.*, e.titulo as exercicio_titulo, e.modulo as exercicio_modulo, e.descricao as exercicio_descricao, e.gabarito as exercicio_gabarito
         FROM submissoes s
         JOIN exercicios e ON s.exercicio_id = e.id
         WHERE s.aluno_id = $1
         ORDER BY s.created_at DESC`,
        [alunoId]
      );

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
      console.error("Erro ao buscar submissÃµes:", error);
      return res.status(500).json({ message: "Erro ao buscar submissÃµes" });
    }
  });

  // GET /exercicios/:exercicioId/submissoes - Listar submissÃµes (admin/professor)
  router.get(
    "/exercicios/:exercicioId/submissoes",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { exercicioId } = req.params;

      try {
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
        console.error("Erro ao buscar submissÃµes:", error);
        return res.status(500).json({ message: "Erro ao buscar submissÃµes" });
      }
    }
  );

  // PUT /submissoes/:submissaoId/corrigir - Corrigir submissÃ£o (admin/professor)
  router.put(
    "/submissoes/:submissaoId/corrigir",
    authGuard(jwtSecret),
    requireRole(["admin", "professor"]),
    async (req: AuthRequest, res) => {
      const { submissaoId } = req.params;

      const parsed = corrigirSubmissaoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados invÃ¡lidos",
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
          return res.status(404).json({ message: "SubmissÃ£o nÃ£o encontrada" });
        }

        const submissao = result.rows[0];

        return res.json({
          message: "SubmissÃ£o corrigida com sucesso!",
          submissao: {
            id: submissao.id,
            exercicioId: submissao.exercicio_id,
            alunoId: submissao.aluno_id,
            resposta: submissao.resposta,
            tipoResposta: submissao.tipo_resposta,
            linguagem: submissao.linguagem,
          nota: parseNotaToNumber(submissao.nota),
          corrigida: submissao.corrigida,
          feedbackProfessor: submissao.feedback_professor,
          arquivoUrl: submissao.arquivo_url,
          arquivoNome: submissao.arquivo_nome,
          createdAt: submissao.created_at,
        },
      });
      } catch (error) {
        console.error("Erro ao corrigir submissÃ£o:", error);
        return res.status(500).json({ message: "Erro ao corrigir submissÃ£o" });
      }
    }
  );

  return router;
}

