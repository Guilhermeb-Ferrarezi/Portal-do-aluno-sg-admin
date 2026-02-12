import cron from "node-cron";
import { pool } from "../db";

export function startWeeklyExerciseReleaseJob() {
  // Rodar todo dia às 00:01
  cron.schedule("1 0 * * *", async () => {
    try {
      console.log(" Verificando liberação de exercícios semanais...");

      const turmasAtivas = await pool.query(`
        SELECT id, nome, data_inicio, duracao_semanas
        FROM turmas
        WHERE ativo = true
          AND cronograma_ativo = true
          AND data_inicio IS NOT NULL
      `);

      for (const turma of turmasAtivas.rows) {
        const { id, nome, data_inicio, duracao_semanas } = turma;

        // Calcular semana atual
        const hoje = new Date();
        const inicio = new Date(data_inicio);
        const diffDias = Math.floor((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        const semanaAtual = Math.floor(diffDias / 7) + 1;

        if (semanaAtual < 1 || semanaAtual > duracao_semanas) {
          console.log(`⏭️  Turma "${nome}": fora do período (semana ${semanaAtual}/${duracao_semanas})`);
          continue;
        }

        // Buscar exercícios da semana atual que ainda não foram atribuídos
        const exercicios = await pool.query(`
          SELECT c.exercicio_id
          FROM cronograma_turma c
          LEFT JOIN exercicio_turma et ON c.exercicio_id = et.exercicio_id AND et.turma_id = c.turma_id
          WHERE c.turma_id = $1 AND c.semana = $2 AND et.exercicio_id IS NULL
          ORDER BY c.ordem
        `, [id, semanaAtual]);

        if (exercicios.rowCount === 0) {
          console.log(`ℹ️  Turma "${nome}": sem exercícios novos para semana ${semanaAtual}`);
          continue;
        }

        // Atribuir exercícios à turma
        for (const ex of exercicios.rows) {
          await pool.query(`
            INSERT INTO exercicio_turma (exercicio_id, turma_id)
            VALUES ($1, $2)
            ON CONFLICT (exercicio_id, turma_id) DO NOTHING
          `, [ex.exercicio_id, id]);
        }

        console.log(` Liberados ${exercicios.rowCount} exercício(s) para turma "${nome}" (semana ${semanaAtual})`);
      }
    } catch (error) {
      console.error(" Erro ao liberar exercícios semanais:", error);
    }
  });

  console.log(" Job de liberação semanal iniciado (diariamente às 00:01)");
}
