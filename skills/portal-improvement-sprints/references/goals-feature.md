# Plano de Implementacao — Feature: Metas (Goals)

> Feature nova: CRUD completo de metas para admin + visao de progresso para alunos.
> Padrao de referencia: `api/src/routes/badges.ts` e `web/src/pages/Medalhas.tsx`.

---

## Schema real do banco (verificado 2026-04-16)

### `goals`
| Coluna | Tipo | Nullable |
|--------|------|----------|
| id | integer | NO |
| name | text | YES |
| description | text | YES |
| type | integer | YES |
| image_url | text | YES |

### `goals_rewards`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | |
| goal_id | integer | NO | |
| badge_id | integer | NO | |
| course_id | integer | NO | |
| points | double precision | YES | |
| created_at | timestamptz | NO | |
| end_date_target | timestamptz | YES | |
| reward_type | integer | NO | 0 |
| start_date_target | timestamptz | YES | |
| points_target | double precision | YES | |

### `goals_students`
| Coluna | Tipo | Nullable | Default |
|--------|------|----------|---------|
| id | integer | NO | |
| user_id | integer | NO | |
| goal_reward_id | integer | NO | |
| course_id | integer | NO | |
| progress | double precision | NO | |
| is_completed | boolean | NO | |
| completed_at | timestamptz | YES | |
| reward_claimed | boolean | NO | false |
| reward_claimed_at | timestamptz | YES | |

### Joins relevantes
- `goals_rewards.badge_id` → `badge.id` (id, name, icon_url)
- `goals_rewards.course_id` → `course.id` (id, name)
- `goals_students.goal_reward_id` → `goals_rewards.id`
- `goals_students.user_id` → `"user".id` (id, name, email)

---

## Modelo mental da feature

```
goal (template)
  └── goal_reward (meta ativa para um curso, com badge + datas + pontos alvo)
        └── goals_students (progresso de cada aluno nessa meta)
```

Um admin cria o `goal` como template, depois cria um ou mais `goals_rewards` vinculando
aquele goal a um curso especifico com badge de recompensa, janela de tempo e meta de pontos.
Alunos sao atribuidos a um `goal_reward` e tem seu progresso monitorado em `goals_students`.

---

## Checklists de implementacao

### Backend — `api/src/routes/goals.route.ts`

#### Setup inicial
- [ ] Criar arquivo `api/src/routes/goals.route.ts` exportando `goalsRouter(jwtSecret)`
- [ ] Registrar no `api/src/server.ts` nas duas posicoes (sem e com prefixo `/api`)
  ```ts
  // ~linha 389 e 420
  app.use(goalsRouter(env.JWT_SECRET));
  app.use("/api", goalsRouter(env.JWT_SECRET));
  ```

#### Tipos TypeScript
- [ ] `DbGoalRow` — colunas de `goals`
- [ ] `DbGoalRewardRow` — colunas de `goals_rewards` + joins (badge_name, course_name)
- [ ] `DbGoalStudentRow` — colunas de `goals_students` + joins (user_name, goal_name)
- [ ] Funcoes mapper `mapGoalRow`, `mapGoalRewardRow`, `mapGoalStudentRow`

#### Zod schemas de validacao
- [ ] `createGoalSchema` — name (required), description, type, imageUrl
- [ ] `updateGoalSchema` — todos opcionais + refinement (pelo menos 1 campo)
- [ ] `createGoalRewardSchema` — goalId, badgeId, courseId, rewardType, pointsTarget, startDateTarget, endDateTarget, points
- [ ] `updateGoalRewardSchema` — todos opcionais
- [ ] `createGoalStudentSchema` — userId, goalRewardId, courseId
- [ ] `updateGoalStudentSchema` — progress, isCompleted

#### Endpoints CRUD — Goals
- [ ] `GET /goals` — lista paginada (limit, offset, q), retorna `{ items, total }`
- [ ] `GET /goals/:id` — detalhe de um goal com seus rewards associados
- [ ] `POST /goals` — cria goal (admin only), aceita imageUrl como base64 ou URL
- [ ] `PUT /goals/:id` — atualiza goal (admin only), trata troca de imagem no R2
- [ ] `DELETE /goals/:id` — deleta goal (admin only), transacao para cascade

#### Endpoints CRUD — Goal Rewards
- [ ] `GET /goals/rewards` — lista com joins (badge_name, course_name, goal_name), filtros por goalId, courseId
- [ ] `POST /goals/rewards` — cria reward (admin only)
- [ ] `PUT /goals/rewards/:id` — atualiza reward (admin only)
- [ ] `DELETE /goals/rewards/:id` — deleta reward (admin only)

#### Endpoints — Goal Students
- [ ] `GET /goals/students` — admin ve todos, aluno ve so os proprios (filtrar por `req.user.sub` se role=aluno)
- [ ] `POST /goals/students` — admin atribui aluno a um goal_reward
- [ ] `PUT /goals/students/:id` — admin atualiza progress / is_completed
- [ ] `POST /goals/students/:id/claim` — aluno resgata recompensa (seta reward_claimed + reward_claimed_at)

#### Qualidade
- [ ] Activity log em todo POST/PUT/DELETE (seguir padrao de `badges.ts`)
- [ ] Tratamento de erro 409 para atribuicao duplicada (mesmo user_id + goal_reward_id)
- [ ] Upload de imagem de goal para R2 (mesmo padrao de `uploadR2.ts` usado em badges)

---

### Frontend — API Service

#### `web/src/services/api/goals.ts`
- [ ] Tipos exportados: `Goal`, `GoalReward`, `GoalStudent`
- [ ] `listarGoals(params)` — GET /goals com paginacao
- [ ] `obterGoal(id)` — GET /goals/:id
- [ ] `criarGoal(dados)` — POST /goals
- [ ] `atualizarGoal(id, dados)` — PUT /goals/:id
- [ ] `deletarGoal(id)` — DELETE /goals/:id
- [ ] `listarGoalRewards(params)` — GET /goals/rewards
- [ ] `criarGoalReward(dados)` — POST /goals/rewards
- [ ] `atualizarGoalReward(id, dados)` — PUT /goals/rewards/:id
- [ ] `deletarGoalReward(id)` — DELETE /goals/rewards/:id
- [ ] `listarGoalStudents(params)` — GET /goals/students
- [ ] `atribuirGoalAoAluno(dados)` — POST /goals/students
- [ ] `atualizarProgressoAluno(id, dados)` — PUT /goals/students/:id
- [ ] `resgatarRecompensa(id)` — POST /goals/students/:id/claim

---

### Frontend — Roteamento

#### `web/src/router/routes.ts`
- [ ] Adicionar `metas: "/dashboard/metas"` ao objeto `appRoutes`

#### `web/src/App.tsx`
- [ ] Importar `MetasPage` com `React.lazy()`
- [ ] Adicionar rota dentro do bloco admin: `<Route path={appRoutes.metas} element={<MetasPage />} />`

#### `web/src/components/Dashboard/DashboardLayout.tsx`
- [ ] Adicionar "Metas" ao menu lateral (admin e professor)

---

### Frontend — Pagina Admin `web/src/pages/Metas.tsx`

#### Estrutura de tabs
- [ ] **Tab "Metas"** — CRUD dos goals (templates)
  - Listagem em cards com image_url, name, description, type
  - Botao criar + form (name, description, type, upload de imagem)
  - Editar e deletar com confirmModal
- [ ] **Tab "Recompensas"** — CRUD de goals_rewards
  - Listagem com: goal_name, course_name, badge_name, points_target, start/end_date_target
  - Botao criar + form (select goal, select curso, select badge, datas, pontos)
  - Editar e deletar
- [ ] **Tab "Alunos"** — visao de progresso
  - Filtros por curso e goal_reward
  - Tabela: aluno, progresso (barra), is_completed, reward_claimed
  - Atribuir aluno manualmente
  - Atualizar progresso de um aluno

#### Componentes a reusar (nao criar novos)
- `DashboardLayout` — wrapper de pagina
- `Pagination` — paginacao das listas
- `PaginatedSelect` — selects de goal, curso, badge
- `Modal` — formularios de criacao/edicao
- `ConfirmModal` — confirmacao de delecao
- `AnimatedToast` — feedback de acoes
- `web/src/components/ui/skeleton.tsx` — loading states

---

### Frontend — Visao do Aluno

- [ ] Criar componente `web/src/components/Goals/StudentGoals.tsx` **OU** adicionar secao na pagina `Medalhas.tsx`
  - Cards por goal_reward com: nome da meta, descricao, barra de progresso (`progress / points_target`)
  - Badge de recompensa (icon_url)
  - Status: "Em andamento" / "Concluida" / "Recompensa disponivel"
  - Botao "Resgatar" quando `is_completed && !reward_claimed`
- [ ] Decidir: rota `/dashboard/metas` acessivel ao aluno tambem (com visao somente-leitura)

---

## Ordem de execucao recomendada

1. Backend — route file com CRUD de goals
2. Backend — endpoints de goals_rewards
3. Backend — endpoints de goals_students + claim
4. Backend — registrar rotas no server.ts
5. Frontend — service `goals.ts`
6. Frontend — rota + entrada no menu
7. Frontend — pagina admin com tabs
8. Frontend — visao do aluno

---

## Verificacao minima

- [ ] `cd api && bun run build` sem erros
- [ ] `cd web && bun run lint && bun run build` sem erros
- [ ] Smoke test: criar goal → criar goal_reward → atribuir aluno → atualizar progresso → claim
- [ ] Aluno nao acessa endpoints de admin (testar retorno 403)
