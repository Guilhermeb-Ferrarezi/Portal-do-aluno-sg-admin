import { pool } from "../db";

export async function initializeDatabaseTables() {
  try {
    console.log("");
    console.log("🚀 Migrações desativadas: usando apenas tabelas já existentes.");
    await pool.query("SELECT 1");
    console.log("✅ Conexão com banco verificada.");
  } catch (error) {
    console.error("❌ Erro ao verificar conexão com banco:", error);
    throw error;
  }
}
