import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { authGuard } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import type { AuthRequest } from "../middlewares/auth";

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
  created_at: string;
  updated_at: string;
};

const createSubmissaoSchema = z.object({
  resposta: z.string().min(1, "Resposta não pode estar vazia"),
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

// Calcula similaridade simples entre dois textos (Levenshtein distance aproximada)
function calcularSimilaridade(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  let diffs = 0;
  for (let i = 0; i < maxLen; i++) {
    if ((a[i] || "") !== (b[i] || "")) diffs++;
  }

  return 1 - diffs / maxLen;
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
      return { completa: false, mensagem: "Formato de regras inválido" };
    }

    const numQuestoes = regrasObj.questoes.length;
    for (let i = 0; i < numQuestoes; i++) {
      if (!respostaObj[`q${i}`]) {
        return {
          completa: false,
          mensagem: `Responda todas as ${numQuestoes} questões antes de enviar.`
        };
      }
    }

    return { completa: true };
  } catch (error) {
    console.error("Erro ao validar múltipla escolha:", error);
    return { completa: false, mensagem: "Formato de resposta inválido" };
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
    console.error("Erro ao validar múltipla escolha:", error);
    return 0;
  }
}

export function submissoesRouter(jwtSecret: string) {
  const router = Router();

  // POST /exercicios/:exercicioId/submissoes - Enviar resposta
  router.post(
    "/exercicios/:exercicioId/submissoes",
    authGuard(jwtSecret),
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

      try {
        // Verificar se exercício existe e buscar prazo
        const userRole = req.user?.role;
        const params: any[] = [exercicioId];
        let query = `SELECT id, descricao, gabarito, tipo_exercicio, prazo, multipla_regras
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
        if (prazo && agora > prazo) {
          return res.status(400).json({
            message: "O prazo para submissão deste exercício já expirou. Não é mais possível enviar respostas."
          });
        }

        const { resposta, tipo_resposta, linguagem } = parsed.data;

        // Validar múltipla escolha completude
        if (multiplaRegras) {
          const validacao = validarMultiplaEscolhaCompleta(resposta, multiplaRegras);
          if (!validacao.completa) {
            return res.status(400).json({
              message: validacao.mensagem || "Responda todas as questões antes de enviar."
            });
          }
        }

        // Detectar tipo de exercício e validar
        let notaAuto = null;
        if (multiplaRegras) {
          // Múltipla escolha - validação automática
          notaAuto = validarMultiplaEscolha(resposta, multiplaRegras);
        } else if (gabarito) {
          // Validação normal por gabarito
          notaAuto = corrigirAutomaticamente(resposta, gabarito, tipo_resposta);
        }
        const verificacaoDescricao = calcularScoreAderencia(resposta, tipo_resposta, descricaoExercicio, gabarito);

        // Inserir submissão
        const result = await pool.query<SubmissaoRow>(
          `INSERT INTO submissoes (exercicio_id, aluno_id, resposta, tipo_resposta, linguagem, nota, corrigida, is_late)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            exercicioId,
            alunoId,
            resposta,
            tipo_resposta,
            linguagem ?? null,
            notaAuto, // nota automática se houver gabarito ou múltipla escolha
            gabarito || multiplaRegras ? true : false, // marcar como corrigida se há gabarito ou múltipla escolha
            isLate ?? false, // marcar como atrasada se passou do prazo
          ]
        );

        const submissao = result.rows[0];

        return res.status(201).json({
          message: isLate ? "Submissão enviada com sucesso (atrasada)" : "Submissão enviada com sucesso!",
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
            createdAt: submissao.created_at,
          },
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
      const { exercicioId } = req.params;
      const alunoId = req.user?.sub;

      if (!alunoId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
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

  // GET /minhas-submissoes - Ver todas as minhas submissões
  router.get("/minhas-submissoes", authGuard(jwtSecret), async (req: AuthRequest, res) => {
    const alunoId = req.user?.sub;

    if (!alunoId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
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
            createdAt: submissao.created_at,
          },
        });
      } catch (error) {
        console.error("Erro ao corrigir submissão:", error);
        return res.status(500).json({ message: "Erro ao corrigir submissão" });
      }
    }
  );

  return router;
}
