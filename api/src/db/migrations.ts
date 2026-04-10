import { pool } from "../db";

export async function initializeDatabaseTables() {
  try {
    console.log("");
    console.log("🚀 Verificando e aplicando migrações necessárias...");
    await pool.query("SELECT 1");
    console.log("✅ Conexão com banco verificada.");
  } catch (error) {
    console.error("❌ Erro ao verificar conexão com banco:", error);
    throw error;
  }
}
