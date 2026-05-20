import { pool } from "../db";

export async function initializeDatabaseTables() {
  try {
    console.log("");
    console.log("🚀 Verificando e aplicando migrações necessárias...");
    await pool.query("SELECT 1");
    await pool.query(
      `ALTER TABLE api_tokens
         ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'integration'`
    );
    await pool.query(
      `ALTER TABLE api_tokens
         ADD COLUMN IF NOT EXISTS codex_version integer NOT NULL DEFAULT 1`
    );
    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS api_tokens_codex_user_id_idx
       ON api_tokens (user_id)
       WHERE kind = 'codex'`
    );
    console.log("✅ Conexão com banco verificada.");
  } catch (error) {
    console.error("❌ Erro ao verificar conexão com banco:", error);
    throw error;
  }
}
