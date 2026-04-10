import { pool } from "../db";

export async function initializeDatabaseTables() {
  try {
    console.log("");
    console.log("🚀 Verificando e aplicando migrações necessárias...");
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_view_sso_codes (
        id BIGSERIAL PRIMARY KEY,
        target TEXT NOT NULL,
        code_hash TEXT NOT NULL UNIQUE,
        source_user_id TEXT NOT NULL,
        source_email TEXT NOT NULL,
        source_name TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS student_view_sso_codes_target_expires_idx
      ON student_view_sso_codes (target, expires_at)
    `);
    console.log("✅ Conexão com banco verificada.");
  } catch (error) {
    console.error("❌ Erro ao verificar conexão com banco:", error);
    throw error;
  }
}
