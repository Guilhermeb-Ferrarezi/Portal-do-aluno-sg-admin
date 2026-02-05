import { pool } from "../db";

export async function initializeDatabaseTables() {
  try {
    console.log("📊 Inicializando tabelas do banco de dados...");

    // Criar tabela videoaulas se não existir
    console.log("🎬 Criando tabela videoaulas...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videoaulas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        modulo VARCHAR(100) NOT NULL,
        duracao VARCHAR(20),
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('youtube', 'vimeo', 'arquivo')),
        url TEXT NOT NULL,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela videoaulas criada/verificada!");

    // Criar tabela material_turma se não existir
    console.log("📚 Criando tabela material_turma...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_turma (
        material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
        turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(material_id, turma_id)
      );
    `);
    console.log("✅ Tabela material_turma criada/verificada!");

    // Criar índices para material_turma
    console.log("🔍 Criando índices para material_turma...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_material_turma_material_id ON material_turma(material_id);
      CREATE INDEX IF NOT EXISTS idx_material_turma_turma_id ON material_turma(turma_id);
    `);
    console.log("✅ Índices de material_turma criados!");

    // Criar tabela videoaula_turma se não existir
    console.log("🎬 Criando tabela videoaula_turma...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videoaula_turma (
        videoaula_id UUID NOT NULL REFERENCES videoaulas(id) ON DELETE CASCADE,
        turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(videoaula_id, turma_id)
      );
    `);
    console.log("✅ Tabela videoaula_turma criada/verificada!");

    // Criar índices para videoaula_turma
    console.log("🔍 Criando índices para videoaula_turma...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videoaula_turma_videoaula_id ON videoaula_turma(videoaula_id);
      CREATE INDEX IF NOT EXISTS idx_videoaula_turma_turma_id ON videoaula_turma(turma_id);
    `);
    console.log("✅ Índices de videoaula_turma criados!");

    console.log("✨ Banco de dados inicializado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
    throw error;
  }
}
