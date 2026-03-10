# Portal do Aluno - Sistema de Cursos e Módulos

**Status Geral:** ✅ Implementação concluída e testada

---

## Resumo Executivo

Sistema de gerenciamento de cursos e exercícios com dois fluxos de acesso:

1. **Cursos Gratuitos (Turmas):** Alunos matriculados veem exercícios do módulo ativo da turma
2. **Cursos Pagos (Sem Turma):** Alunos desbloqueiam módulos proporcionalmente ao progresso

Implementação: **Código apenas** (sem alterações de schema)

---

## Correções Recentes

### Listagem de cursos e turmas
- Ajustado o fluxo de consulta e retorno dos cursos usados na listagem e nas turmas
- Mantido o uso direto das colunas `duration_hours`, `level`, `focus` e `price`, já existentes na tabela `course`
- Aplicado em:
  - listagem de cursos
  - criação de curso
  - carregamento de curso por id
  - resolução de cursos nas turmas

### Correção do erro 500 em cursos
- Removidos os arquivos de agendamento de exercícios que não eram mais necessários
- A API de cursos e estatísticas da estrutura agora retorna resposta vazia/segura quando a estrutura de `course` não existe no banco atual, evitando erro 500 na tela
- Ajustado o mapeamento da tabela `course` para usar as colunas reais `level_difficulty` e `paid_focus` na listagem/criação
- Nenhuma tabela ou coluna foi criada/alterada

### Botão de detalhes no curso selecionado
- Adicionado botão **Ver detalhes** no card do curso selecionado na tela de estrutura
- O botão abre o modal existente de detalhes do curso sem precisar clicar novamente na lista

### Ajuste de interação na lista de cursos
- Clique no item da lista agora apenas seleciona o curso
- Abertura de detalhes ficou centralizada no botão **Ver detalhes** do card selecionado
- Adicionada animação de loading durante o carregamento da página atual de cursos

### Selects de curso com paginação remota
- Os selects de curso nas abas de módulos e fases deixaram de carregar todos os cursos de uma vez
- Agora usam busca e paginação remota com a API de cursos
- O curso selecionado continua visível no trigger mesmo quando não está na página atual do dropdown

### Select de fases com paginação remota
- O select de fases no formulário de exercícios agora busca páginas da API em vez de carregar todas as fases do módulo
- Mantida busca remota, navegação por página e exibição da fase selecionada fora da página atual

### Rollout completo de paginação remota com animação
- Aplicado também aos selects de módulos restantes na estrutura do curso e no formulário de exercícios
- O loading dos selects remotos agora exibe animação visual durante a busca
- Mantido o comportamento de exibir o item selecionado mesmo fora da página atual

### Sidebar com dropdown persistente
- Estado dos dropdowns **Usuários** e **Estrutura do Curso** agora é preservado entre navegações
- Ao clicar em um subitem da sidebar, os outros dropdowns que já estavam abertos não são mais fechados automaticamente
- Persistência feita com `localStorage`

### Formulário de exercícios sem select duplicado de curso
- Removido o segundo campo **Curso** do formulário de criação de exercícios
- A seleção de curso agora fica centralizada apenas nos cards/toggles do topo da tela
- Mantido o mesmo comportamento de limpeza de módulo e fase ao trocar o curso

### Reposicionamento da seleção de curso em exercícios
- A área visual de seleção de curso foi movida para o bloco onde ficava o campo inferior de curso
- O formulário agora mostra primeiro o tipo de exercício e, logo abaixo, os cards de curso com paginação e detalhes
- Mantida a mesma interação de seleção, filtro e visualização de detalhes do curso

### Correção do erro `column "level" does not exist`
- Refatoradas as consultas de curso no backend para detectar automaticamente quais colunas existem de fato na tabela `course`
- O arquivo [api/src/routes/turmas.route.ts](api/src/routes/turmas.route.ts) agora funciona tanto com `level` / `focus` quanto com `level_difficulty` / `paid_focus`
- A compatibilidade foi aplicada na listagem de cursos, busca por curso, curso preferencial, criação de curso e hidratação de cursos nas turmas

### Correção do `difficulty` inválido ao criar exercício
- Ajustado o envio de `difficulty` no frontend para mandar valores numéricos, como o backend espera
- O valor `2` representa **Normal** e o valor `1` representa **Lower (Recuperação)**
- Aplicado em [web/src/components/CriarExercicioForm.tsx](web/src/components/CriarExercicioForm.tsx) e [web/src/pages/Exercises.tsx](web/src/pages/Exercises.tsx)

---

## Arquitetura de Acesso

### Fluxo A: Alunos em Turmas (Gratuitos)

**Condição de acesso:**
```
Aluno vê exercício SE está em turma E exercício está no módulo ativo da turma
```

**Dados envolvidos:**
- `enrollment` (user_id, class_id)
- `class` (current_module_id - módulo ativo da turma)
- `module` (do exercício)

**Lógica SQL** (3 queries em `api/src/routes/exercicios.route.ts`):
```sql
EXISTS (
  SELECT 1 FROM enrollment en
  JOIN class c ON c.id = en.class_id
  JOIN phase p2 ON p2.module_id = c.current_module_id
  WHERE en.user_id = $1 AND p2.id = e.phase_id
)
```

---

### Fluxo B: Alunos com Cursos Pagos (Sem Turma)

**Condição de acesso:**
```
Aluno vê exercício SE progresso desbloqueia o módulo do exercício
```

**Fórmula de desbloqueio:**
```
module.index_order <= CEIL(progress_percentage / 100 * total_modules_in_course)
```

**Exemplos:**
- 3 módulos, 50% progresso → acesso até módulo 2
- 3 módulos, 100% progresso → acesso a todos os 3 módulos
- 5 módulos, 33% progresso → acesso até módulo 2

**Dados envolvidos:**
- `progress_paid_courses` (user_id, course_id, progress_percentage)
- `course` (id)
- `module` (index_order, course_id)
- `phase` (module_id)

**Lógica SQL** (mesmo padrão em 3 queries):
```sql
EXISTS (
  SELECT 1 FROM progress_paid_courses ppc
  JOIN course co ON co.id = ppc.course_id
  JOIN module m2 ON m2.course_id = co.id
  JOIN phase p2 ON p2.module_id = m2.id
  WHERE ppc.user_id = $1
    AND p2.id = e.phase_id
    AND m2.index_order <= CEIL(ppc.progress_percentage / 100 * COALESCE((SELECT COUNT(*) FROM module WHERE course_id = co.id), 1))
)
```

**Resultado final (ambos fluxos):**
```sql
WHERE (Fluxo A) OR (Fluxo B)
```

---

## Estrutura do Banco de Dados

### Tabela: `course`
```
id                SERIAL PRIMARY KEY
name              VARCHAR
description       TEXT
is_paid           BOOLEAN
duration_hours    INTEGER          ← Cursos (pago/gratuito)
level             VARCHAR(50)      ← Nível de dificuldade
focus             VARCHAR(255)     ← Qualidade do curso pago
price             NUMERIC(10,2)    ← Preço para cursos pagos
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### Tabela: `class` (Turmas)
```
id                SERIAL PRIMARY KEY
course_id         INTEGER (FK course)
name              VARCHAR
current_module_id INTEGER (FK module) ← Módulo ativo da turma
start_date        DATE
end_date          DATE
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### Tabela: `enrollment` (Acesso via Turma)
```
user_id           INTEGER (FK user)
class_id          INTEGER (FK class)
created_at        TIMESTAMP
PRIMARY KEY(user_id, class_id)
```

### Tabela: `module`
```
id                SERIAL PRIMARY KEY
course_id         INTEGER (FK course)
name              VARCHAR
description       TEXT
index_order       INTEGER  ← Ordem no formato 1, 2, 3... (editável)
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### Tabela: `phase` (Fases de Módulo)
```
id                SERIAL PRIMARY KEY
module_id         INTEGER (FK module)
name              VARCHAR
week_number       INTEGER
index_order       INTEGER  ← Ordem automática, editável
admin_authorize   BOOLEAN  ← Requer aprovação admin
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### Tabela: `exercise`
```
id                SERIAL PRIMARY KEY
phase_id          INTEGER (FK phase)
title             VARCHAR
description       TEXT
is_daily_task     BOOLEAN  ← Tarefa diária?
term_at           TIMESTAMP ← Prazo de entrega
video_url         TEXT
difficulty        INTEGER  ← 1-lower 2-normal
index_order       INTEGER  ← Ordem do exercício
is_final_exercise BOOLEAN  ← Exercício final?
points_redeem     INTEGER  ← Pontos para resgate
exercise_period   DATE     ← Período ativo
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

### Tabela: `progress_paid_courses` ✅ (Em Uso)
```
id                SERIAL PRIMARY KEY
user_id           INTEGER NOT NULL (FK user)
course_id         INTEGER NOT NULL (FK course)
progress_percentage NUMERIC(5,2) DEFAULT 0
last_accessed     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
UNIQUE(user_id, course_id)
```

**Função:** Rastrear progresso de alunos em cursos pagos para calcular desbloqueio de módulos.

---

## API - Endpoints

### Courses

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/courses` | Listar todos os cursos |
| POST | `/courses` | Criar novo curso |
| DELETE | `/courses/:id` | Deletar curso |
| GET | `/courses/:courseId/modules` | Listar módulos de um curso |

### Classes (Turmas)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/turmas` | Listar turmas (alunos veem suas) |
| POST | `/turmas` | Criar turma |
| PUT | `/turmas/:id` | Editar turma |
| GET | `/turmas/:id` | Detalhes de turma |
| DELETE | `/turmas/:id` | Deletar turma |
| GET | `/turmas/total` | Contar turmas |

### Exercises

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/exercicios` | Listar exercícios (filtrados por acesso) |
| POST | `/exercicios` | Criar exercício |
| PUT | `/exercicios/:id` | Editar exercício |
| DELETE | `/exercicios/:id` | Deletar exercício |
| GET | `/exercicios/by-phase/:phaseId` | Exercícios de uma fase |
| PATCH | `/exercicios/:id/reorder` | Reordenar exercício |

### Users

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/users` | Listar usuários |
| POST | `/users` | Criar usuário *(não contém `initial_module_id`)* |
| PUT | `/users/:id` | Editar usuário |
| DELETE | `/users/:id` | Deletar usuário |

---

## Implementação Frontend

### Páginas Funcionais

✅ **Dashboard**
- Sidebar com menu "Estrutura do Curso"
- Cards de turmas onde aluno está matriculado

✅ **Estrutura do Curso** (`/dashboard/estrutura-curso`)
- Abas: **Cursos** | **Módulos** | **Fases** | **Exercícios**
- CRUD completo (criar/editar/deletar)
- Reordenação automática com `index_order`

✅ **Turmas** (`/dashboard/turmas`)
- Listar turmas
- Criar turma com módulo inicial configurável
- Gerenciar alunos (add/remove)
- Deletar turma

✅ **Exercícios** (`/dashboard/exercicios`)
- Criar com dificuldade e tipo
- Editar ordem
- Listar por fase com reordenação
- Publicar/Despublicar

✅ **Gerenciar Usuários** (`/dashboard/usuarios`)
- Criar usuário *(sem campo de módulo inicial)*
- Listar/Editar/Deletar
- Filtrar por role

---


---

## Próximos Passos (Opcionais)

1. Implementar lógica de atualizar `progress_percentage` ao aluno enviar exercícios
2. Adicionar cache: coluna `current_module_id` em `progress_paid_courses`
3. Sistema de certificação ao atingir 100% em curso pago
4. Integração com sistema de badges/pontos
5. Relatórios de progresso por aluno/curso

