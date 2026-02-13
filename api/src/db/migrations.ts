import { pool } from "../db";
import bcrypt from "bcrypt";

export async function initializeDatabaseTables() {
  try {
    console.log("")
    console.log("🚀 Inicializando tabelas do banco de dados...");

    // ===== Criar tabela users (base) =====
    console.log("🧱 Criando tabela users se nao existir...");
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
      const defaultPassword = process.env.INIT_ADMIN_PASSWORD || ""; 
      const hash = bcrypt.hashSync(defaultPassword, 10);
      await pool.query(`INSERT INTO users (usuario, nome, senha_hash, role, ativo) VALUES ('admin','Admin',$1,'admin',true)`, [hash]);
      console.log("👑 Admin inicial criado: usuario=admin (senha padrao definida)");
    }

    // ===== Criar tabela refresh_tokens =====
    console.log("🧱 Criando tabela refresh_tokens se nao existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `);
    console.log("✅ Tabela refresh_tokens criada/verificada!");

    // ===== Criar tabela turmas =====
    console.log("🧱 Criando tabela turmas se nao existir...");
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
    console.log("🧱 Criando tabela materiais se nao existir...");
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
    console.log("🧱 Criando tabela exercicios se nao existir...");
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
        max_tentativas INTEGER DEFAULT NULL,
        penalidade_por_tentativa NUMERIC(5,2) DEFAULT 0,
        intervalo_reenvio INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela exercicios criada/verificada!");

    // ===== Criar tabela submissoes =====
    console.log("🧱 Criando tabela submissoes se nao existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submissoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        exercicio_id UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
        aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resposta TEXT,
        tipo_resposta VARCHAR(20) DEFAULT 'texto',
        linguagem VARCHAR(50),
        nota NUMERIC(5,2),
        corrigida BOOLEAN DEFAULT false,
        feedback_professor TEXT,
        is_late BOOLEAN DEFAULT false,
        arquivo_url TEXT DEFAULT NULL,
        arquivo_nome TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_submissoes_exercicio ON submissoes(exercicio_id);
      CREATE INDEX IF NOT EXISTS idx_submissoes_aluno ON submissoes(aluno_id);
    `);
    console.log("✅ Tabela submissoes criada/verificada!");

    // ===== Criar tabela aluno_turma =====
    console.log("🧱 Criando tabela aluno_turma se nao existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aluno_turma (
        aluno_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(aluno_id, turma_id)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_aluno_turma_aluno_id ON aluno_turma(aluno_id);
      CREATE INDEX IF NOT EXISTS idx_aluno_turma_turma_id ON aluno_turma(turma_id);
    `);
    console.log("✅ Tabela aluno_turma criada/verificada!");

    // ===== Criar tabela exercicio_turma =====
    console.log("🧱 Criando tabela exercicio_turma se nao existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exercicio_turma (
        exercicio_id UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
        turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(exercicio_id, turma_id)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exercicio_turma_exercicio_id ON exercicio_turma(exercicio_id);
      CREATE INDEX IF NOT EXISTS idx_exercicio_turma_turma_id ON exercicio_turma(turma_id);
    `);
    console.log("✅ Tabela exercicio_turma criada/verificada!");

    // ===== Criar tabela cronograma_turma =====
    console.log("🧱 Criando tabela cronograma_turma se nao existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cronograma_turma (
        turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
        exercicio_id UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
        semana INTEGER NOT NULL,
        ordem INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(turma_id, exercicio_id, semana)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cronograma_turma_turma_id ON cronograma_turma(turma_id);
      CREATE INDEX IF NOT EXISTS idx_cronograma_turma_exercicio_id ON cronograma_turma(exercicio_id);
    `);
    console.log("✅ Tabela cronograma_turma criada/verificada!");

    // Criar tabela videoaulas se não existir
    console.log("🧱 Criando tabela videoaulas...");
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
    console.log("🧱 Criando tabela material_turma...");
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
    console.log("🧭 Criando indices para material_turma...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_material_turma_material_id ON material_turma(material_id);
      CREATE INDEX IF NOT EXISTS idx_material_turma_turma_id ON material_turma(turma_id);
    `);
    console.log("✅ Indices de material_turma criados!");

    // Criar tabela videoaula_turma se não existir
    console.log("🧱 Criando tabela videoaula_turma...");
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
    console.log("🧭 Criando indices para videoaula_turma...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videoaula_turma_videoaula_id ON videoaula_turma(videoaula_id);
      CREATE INDEX IF NOT EXISTS idx_videoaula_turma_turma_id ON videoaula_turma(turma_id);
    `);
    console.log("✅ Indices de videoaula_turma criados!");

    // Criar tabela material_aluno se não existir
    console.log("🧱 Criando tabela material_aluno...");
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
    console.log("🧭 Criando indices para material_aluno...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_material_aluno_material_id ON material_aluno(material_id);
      CREATE INDEX IF NOT EXISTS idx_material_aluno_aluno_id ON material_aluno(aluno_id);
    `);
    console.log("✅ Indices de material_aluno criados!");

    // Criar tabela videoaula_aluno se não existir
    console.log("🧱 Criando tabela videoaula_aluno...");
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
    console.log("🧭 Criando indices para videoaula_aluno...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_videoaula_aluno_videoaula_id ON videoaula_aluno(videoaula_id);
      CREATE INDEX IF NOT EXISTS idx_videoaula_aluno_aluno_id ON videoaula_aluno(aluno_id);
    `);
    console.log("✅ Indices de videoaula_aluno criados!");

    // Criar tabela exercicio_aluno se não existir
    console.log("🧱 Criando tabela exercicio_aluno...");
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
    console.log("🧭 Criando indices para exercicio_aluno...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exercicio_aluno_exercicio_id ON exercicio_aluno(exercicio_id);
      CREATE INDEX IF NOT EXISTS idx_exercicio_aluno_aluno_id ON exercicio_aluno(aluno_id);
    `);
    console.log("✅ Indices de exercicio_aluno criados!");

    // Adicionar coluna atalho_tipo na tabela exercicios se não existir
    console.log("⌨️ Adicionando suporte a atalhos na tabela exercicios...");
    try {
      await pool.query(`
        ALTER TABLE exercicios
        ADD COLUMN IF NOT EXISTS atalho_tipo VARCHAR(50) CHECK (atalho_tipo IN ('copiar-colar', 'copiar-colar-imagens', 'selecionar-deletar'));
      `);
      console.log("✅ Coluna atalho_tipo adicionada!");
    } catch (error) {
      console.warn("⚠️ Coluna atalho_tipo ja existe ou erro ao adicionar:", (error as any).message);
    }

    // Adicionar coluna permitir_repeticao na tabela exercicios se não existir
    console.log("➕ Adicionando suporte a permitir_repeticao na tabela exercicios...");
    try {
      await pool.query(`
        ALTER TABLE exercicios
        ADD COLUMN IF NOT EXISTS permitir_repeticao BOOLEAN DEFAULT false;
      `);
      console.log("✅ Coluna permitir_repeticao adicionada!");
    } catch (error) {
      console.warn("⚠️ Coluna permitir_repeticao ja existe ou erro ao adicionar:", (error as any).message);
    }

      // Adicionar colunas de política de tentativas
      console.log("➕ Adicionando suporte a politica de tentativas na tabela exercicios...");
      try {
        await pool.query(`
          ALTER TABLE exercicios
        ADD COLUMN IF NOT EXISTS max_tentativas INTEGER DEFAULT NULL;
      `);
      await pool.query(`
        ALTER TABLE exercicios
        ADD COLUMN IF NOT EXISTS penalidade_por_tentativa NUMERIC(5,2) DEFAULT 0;
      `);
        await pool.query(`
          ALTER TABLE exercicios
          ADD COLUMN IF NOT EXISTS intervalo_reenvio INTEGER DEFAULT NULL;
        `);
        console.log("✅ Colunas de politica de tentativas adicionadas!");
      } catch (error) {
        console.warn("⚠️ Erro ao adicionar colunas de tentativas:", (error as any).message);
      }

      // Ajustar constraint de tipo_exercicio para incluir "escrita"
      console.log("➕ Ajustando constraint de tipo_exercicio...");
      try {
        await pool.query(`
          ALTER TABLE exercicios
          DROP CONSTRAINT IF EXISTS exercicios_tipo_exercicio_check;
        `);
        await pool.query(`
          ALTER TABLE exercicios
          ADD CONSTRAINT exercicios_tipo_exercicio_check
          CHECK (tipo_exercicio IS NULL OR tipo_exercicio IN ('nenhum','codigo','texto','escrita','mouse','multipla','atalho'));
        `);
        console.log("✅ Constraint de tipo_exercicio ajustada!");
      } catch (error) {
        console.warn("⚠️ Erro ao ajustar constraint de tipo_exercicio:", (error as any).message);
      }

      // Adicionar colunas de anexos na tabela exercicios
      console.log("➕ Adicionando suporte a anexos na tabela exercicios...");
      try {
        await pool.query(`
          ALTER TABLE exercicios
          ADD COLUMN IF NOT EXISTS anexo_url TEXT DEFAULT NULL;
        `);
        await pool.query(`
          ALTER TABLE exercicios
          ADD COLUMN IF NOT EXISTS anexo_nome TEXT DEFAULT NULL;
        `);
        console.log("✅ Colunas de anexos adicionadas em exercicios!");
      } catch (error) {
        console.warn("⚠️ Erro ao adicionar colunas de anexos em exercicios:", (error as any).message);
      }

    // Adicionar colunas de anexos em submissoes
    console.log("➕ Adicionando suporte a anexos na tabela submissoes...");
    try {
      await pool.query(`
        ALTER TABLE submissoes
        ADD COLUMN IF NOT EXISTS arquivo_url TEXT DEFAULT NULL;
      `);
      await pool.query(`
        ALTER TABLE submissoes
        ADD COLUMN IF NOT EXISTS arquivo_nome TEXT DEFAULT NULL;
      `);
      console.log("✅ Colunas de anexos adicionadas!");
    } catch (error) {
      console.warn("⚠️ Erro ao adicionar colunas de anexos:", (error as any).message);
    }

    // ===== Criar tabela activity_logs =====
    console.log("🧱 Criando tabela activity_logs se nao existir...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_role VARCHAR(20),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        metadata JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela activity_logs criada/verificada!");

    console.log("🧭 Criando indices para activity_logs...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON activity_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
    `);
    console.log("✅ Indices de activity_logs criados!");

    console.log("🎉 Banco de dados inicializado com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao inicializar banco de dados:", error);
    throw error;
  }
}
