import { pool } from "../db";
import bcrypt from "bcrypt";

export async function initializeDatabaseTables() {
  try {
    console.log("📊 Inicializando tabelas do banco de dados...");

    // ===== Criar tabela users (base) =====
    console.log("👥 Criando tabela users se não existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario VARCHAR(100) UNIQUE NOT NULL,
        nome VARCHAR(255) NOT NULL,
        senha_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'aluno' CHECK (role IN ('admin','professor','aluno')),
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela users criada/verificada!");

    // Se não houver usuários, criar um admin inicial (senha padrão 'admin123' ou `INIT_ADMIN_PASSWORD`)
    const usersCount = await pool.query(`SELECT COUNT(*)::int as cnt FROM users`);
    if (Number(usersCount.rows[0].cnt) === 0) {
      const defaultPassword = process.env.INIT_ADMIN_PASSWORD ?? "admin123";
      const hash = bcrypt.hashSync(defaultPassword, 10);
      await pool.query(`INSERT INTO users (usuario, nome, senha_hash, role, ativo) VALUES ('admin','Admin',$1,'admin',true)`, [hash]);
      console.log("🔧 Admin inicial criado: usuario=admin (senha padrão definida)");
    }

    // ===== Criar tabela turmas =====
    console.log("🏫 Criando tabela turmas se não existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS turmas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'turma',
        categoria VARCHAR(50) DEFAULT 'programacao',
        professor_id UUID REFERENCES users(id),
        descricao TEXT,
        ativo BOOLEAN DEFAULT true,
        data_inicio TIMESTAMP NULL,
        duracao_semanas INTEGER DEFAULT 12,
        cronograma_ativo BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela turmas criada/verificada!");

    // ===== Criar tabela materiais =====
    console.log("📦 Criando tabela materiais se não existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS materiais (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo VARCHAR(255) NOT NULL,
        tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('arquivo','link')),
        modulo VARCHAR(100) NOT NULL,
        descricao TEXT,
        url TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela materiais criada/verificada!");

    // ===== Criar tabela exercicios =====
    console.log("✍️ Criando tabela exercicios se não existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exercicios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT NOT NULL,
        modulo VARCHAR(100) NOT NULL,
        tema VARCHAR(255),
        prazo TIMESTAMP NULL,
        publicado BOOLEAN DEFAULT false,
        published_at TIMESTAMP NULL,
        created_by UUID REFERENCES users(id),
        tipo_exercicio VARCHAR(50),
        gabarito TEXT,
        linguagem_esperada VARCHAR(100),
        is_template BOOLEAN DEFAULT false,
        categoria VARCHAR(100) DEFAULT 'programacao',
        mouse_regras TEXT,
        multipla_regras TEXT,
        atalho_tipo VARCHAR(50),
        permitir_repeticao BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela exercicios criada/verificada!");

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

    // Criar tabela material_aluno se não existir
    console.log("📚 Criando tabela material_aluno...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_aluno (
        material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
        aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(material_id, aluno_id)
      );
    `);
    console.log("✅ Tabela material_aluno criada/verificada!");

    // Criar índices para material_aluno
    console.log("🔍 Criando índices para material_aluno...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_material_aluno_material_id ON material_aluno(material_id);
      CREATE INDEX IF NOT EXISTS idx_material_aluno_aluno_id ON material_aluno(aluno_id);
    `);
    console.log("✅ Índices de material_aluno criados!");

    // Criar tabela videoaula_aluno se não existir
    console.log("🎬 Criando tabela videoaula_aluno...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS videoaula_aluno (
        videoaula_id UUID NOT NULL REFERENCES videoaulas(id) ON DELETE CASCADE,
        aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(videoaula_id, aluno_id)
      );
    `);
    console.log("✅ Tabela videoaula_aluno criada/verificada!");

    // Criar índices para videoaula_aluno
    console.log("🔍 Criando índices para videoaula_aluno...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videoaula_aluno_videoaula_id ON videoaula_aluno(videoaula_id);
      CREATE INDEX IF NOT EXISTS idx_videoaula_aluno_aluno_id ON videoaula_aluno(aluno_id);
    `);
    console.log("✅ Índices de videoaula_aluno criados!");

    // Criar tabela exercicio_aluno se não existir
    console.log("✍️ Criando tabela exercicio_aluno...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exercicio_aluno (
        exercicio_id UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
        aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(exercicio_id, aluno_id)
      );
    `);
    console.log("✅ Tabela exercicio_aluno criada/verificada!");

    // Criar índices para exercicio_aluno
    console.log("🔍 Criando índices para exercicio_aluno...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exercicio_aluno_exercicio_id ON exercicio_aluno(exercicio_id);
      CREATE INDEX IF NOT EXISTS idx_exercicio_aluno_aluno_id ON exercicio_aluno(aluno_id);
    `);
    console.log("✅ Índices de exercicio_aluno criados!");

    // Adicionar coluna atalho_tipo na tabela exercicios se não existir
    console.log("⌨️ Adicionando suporte a atalhos na tabela exercicios...");
    try {
      await pool.query(`
        ALTER TABLE exercicios
        ADD COLUMN IF NOT EXISTS atalho_tipo VARCHAR(50) CHECK (atalho_tipo IN ('copiar-colar', 'copiar-colar-imagens', 'selecionar-deletar'));
      `);
      console.log("✅ Coluna atalho_tipo adicionada!");
    } catch (error) {
      console.warn("⚠️ Coluna atalho_tipo já existe ou erro ao adicionar:", (error as any).message);
    }

    // Adicionar coluna permitir_repeticao na tabela exercicios se não existir
    console.log("🔁 Adicionando suporte a permitir_repeticao na tabela exercicios...");
    try {
      await pool.query(`
        ALTER TABLE exercicios
        ADD COLUMN IF NOT EXISTS permitir_repeticao BOOLEAN DEFAULT false;
      `);
      console.log("✅ Coluna permitir_repeticao adicionada!");
    } catch (error) {
      console.warn("⚠️ Coluna permitir_repeticao já existe ou erro ao adicionar:", (error as any).message);
    }

    console.log("✨ Banco de dados inicializado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
    throw error;
  }
}
