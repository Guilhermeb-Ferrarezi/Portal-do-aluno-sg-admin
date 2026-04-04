# CLAUDE.md

## Objetivo deste arquivo

Este projeto e um portal do aluno com frontend React/Vite e backend Express/TypeScript.
Use este guia para trabalhar com mais velocidade, ler menos arquivos desnecessarios e evitar regressões nos fluxos principais.

## Skills locais do projeto

- Antes de planejar ou executar melhorias, refactors, backlog, roadmap, polimento de UX ou reducao de divida tecnica, leia e siga `skills/portal-improvement-sprints/SKILL.md`.
- Use `skills/portal-improvement-sprints/references/sprint-board.md` como fonte de verdade para priorizacao e acompanhamento dessas melhorias.
- Ao concluir um item dessa skill, atualize o checkbox correspondente e a linha `Progresso:` no mesmo commit.
- Se surgirem novas skills em `skills/*/SKILL.md`, aplique a skill relevante quando o pedido combinar com ela.

## Stack do projeto

- `web/`: Vite 7, React 19, TypeScript, Tailwind 4, shadcn/ui, Radix UI, Framer Motion
- `api/`: Express 5, TypeScript, `pg`, JWT, WebSocket (`ws`), `zod`
- Infra local: `docker-compose.yml` sobe `web`, `api`, `db` e `db_proxy`
- Gerenciador de pacotes: `npm`
- Versao de Node esperada: 22.x (alinhada com os Dockerfiles)

## Regras criticas do projeto

- Nunca crie ou altere tabelas/colunas sem aprovacao explicita do usuario.
- Se uma mudanca parecer exigir schema novo, primeiro verifique se o campo ja existe e depois documente o SQL/ajuste necessario para o usuario decidir.
- Nao exponha nem replique segredos de `.env` em respostas, commits ou documentacao.
- Sempre prefira usar componentes existentes de `shadcn`/`Radix` e os wrappers em `web/src/components/ui`.

## Como rodar

### Desenvolvimento local por modulo

- API:
  - `cd api`
  - `npm install`
  - `npm run dev`
- Web:
  - `cd web`
  - `npm install`
  - `npm run dev`

### Stack completa com Docker

- `docker compose up -d --build`
- Frontend via compose: `http://localhost:8080`
- API via compose: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

### Script de smoke test/deploy local

- Linux/macOS: `./deploy_and_push.sh`
- Windows: `deploy_and_push.bat`
- Use o script para validar deploy local, mas sem fazer commit/push automatico a menos que o usuario peça.

## Verificacao minima antes de concluir

- Backend: `cd api && npm run build`
- Frontend: `cd web && npm run lint && npm run build`
- Se a mudanca afetar runtime, login, websocket, upload ou proxy, rode tambem a stack com Docker e faca smoke test no navegador.

Observacao: nao ha suite de testes automatizada no repositorio no momento. Build + smoke test sao a verificacao minima.

## Mapa rapido do repositorio

### Backend

- `api/src/server.ts`
  - bootstrap do Express
  - CORS
  - rate limit
  - health checks
  - registro das rotas
  - inicializacao do WebSocket de presenca
- `api/src/db.ts`
  - conexao com Postgres via `DATABASE_URL` ou `DB_*`
- `api/src/db/migrations.ts`
  - hoje apenas verifica conectividade; nao cria schema
- `api/src/middlewares/auth.ts`
  - autenticacao JWT e normalizacao de papel
- `api/src/middlewares/requireRole.ts`
  - autorizacao por papel
- `api/src/routes/*.ts`
  - regras de negocio por dominio
- `api/src/realtime/presence.ts`
  - servidor WebSocket de presenca
- `api/src/routes/presence.ts`
  - emissao de ticket e heartbeat HTTP
- `api/src/utils/uploadR2.ts`
  - upload de arquivos para R2

### Frontend

- `web/src/App.tsx`
  - roteamento principal
  - lazy loading
  - controle global de sessao
  - conexao/desconexao do socket de presenca
- `web/src/auth/auth.ts`
  - tokens, refresh token e normalizacao de papel no `localStorage`
- `web/src/auth/ProtectedRoute.tsx`
  - protecao de rotas por login/papel
- `web/src/services/api.ts`
  - cliente HTTP principal
  - refresh automatico de token
  - tipos compartilhados usados nas paginas
- `web/src/services/presenceSocket.ts`
  - conexao WebSocket e heartbeat de presenca
- `web/src/components/Dashboard/DashboardLayout.tsx`
  - shell visual do painel e navegacao lateral
- `web/src/components/ui/*`
  - componentes-base reutilizaveis
- `web/src/pages/*`
  - telas de rota

## Arquivos grandes: nao leia inteiro sem necessidade

Os maiores hotspots do repositorio sao:

- `web/src/pages/Exercises.tsx`
- `api/src/routes/exercicios.route.ts`
- `web/src/pages/EstruturaCurso.tsx`
- `api/src/routes/turmas.route.ts`
- `api/src/routes/submissoes.route.ts`
- `web/src/services/api.ts`

Para economizar contexto:

- primeiro use `rg -n "termo"` para localizar a funcao/rota/estado certo
- depois abra so o trecho relevante com `sed -n 'inicio,fimp'`
- so leia o arquivo inteiro quando estiver refatorando a arquitetura daquela feature

## Convencoes importantes deste projeto

### API com e sem prefixo `/api`

O backend registra rotas em duas formas:

- sem prefixo, por exemplo `/auth/login`
- com prefixo `/api`, por exemplo `/api/auth/login`

Ao criar ou alterar endpoints, preserve a compatibilidade com os dois modos quando isso seguir o padrao existente. O frontend normalmente usa `/api`.

### Auth e papeis

Mapeamento de papel:

- `1 = aluno`
- `2 = professor`
- `3 = admin`

O backend costuma trafegar papel numerico no JWT e o frontend normaliza para string.
Se mudar auth, revise em conjunto:

- `api/src/routes/auth.ts`
- `api/src/middlewares/auth.ts`
- `web/src/auth/auth.ts`
- `web/src/auth/ProtectedRoute.tsx`
- `web/src/services/api.ts`

### Presenca em tempo real

O fluxo de presenca depende de:

- `POST /presence/socket-ticket`
- `POST /presence/heartbeat`
- WebSocket em `/ws/presence` e `/api/ws/presence`

Em dev, o Vite faz proxy de `/api` e `/ws`.
Em producao, o `nginx.conf` do frontend encaminha `/api/*` para a API e faz bridge de `/ws/*` para `/api/ws/*`.

Se alterar presenca, sempre revisar em conjunto:

- `api/src/routes/presence.ts`
- `api/src/realtime/presence.ts`
- `web/src/services/presenceSocket.ts`
- `web/src/App.tsx`

### Banco de dados

- O projeto usa schema existente.
- A conexao pode vir de `DATABASE_URL` ou `DB_SERVER`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`.
- O compose usa `db_proxy` para conectar a um banco remoto existente.
- Nao assuma que migracoes criam tabelas: hoje elas apenas validam conexao.

### Frontend e UI

- Mantenha a linguagem visual ja existente: painel denso, glassmorphism leve, cards fortes, sidebar elaborada e animacoes com Framer Motion.
- Reaproveite componentes em `web/src/components/ui` antes de criar markup novo.
- O alias `@/*` aponta para `web/src/*`.
- Evite `fetch` cru para endpoints autenticados; prefira `apiFetch` em `web/src/services/api.ts`.

## Fluxo recomendado para trabalhar com performance de contexto

1. Identifique se a mudanca e de `web`, `api` ou ambos.
2. Leia primeiro o arquivo de entrada da feature:
   - rotas: `api/src/server.ts` + arquivo em `api/src/routes/*`
   - auth: `web/src/auth/auth.ts` e `web/src/services/api.ts`
   - paginas: `web/src/App.tsx` + pagina em `web/src/pages/*`
3. Localize trechos com `rg` antes de abrir arquivos grandes.
4. Faça a menor mudanca consistente possivel.
5. Se alterar contrato de API, atualize tambem os tipos usados em `web/src/services/api.ts`.
6. Rode build/lint e depois smoke test se a mudanca for visivel ou afetar integracao.

## Atalhos mentais por tipo de tarefa

### Se o pedido for sobre login/sessao

Comece por:

- `api/src/routes/auth.ts`
- `web/src/auth/auth.ts`
- `web/src/services/api.ts`
- `web/src/App.tsx`

### Se o pedido for sobre usuarios/papeis

Comece por:

- `api/src/routes/users.ts`
- `api/src/middlewares/requireRole.ts`
- `web/src/pages/AdminUsers.tsx`
- `web/src/components/Dashboard/Sidebar/CreateUser/CreateUser.tsx`

### Se o pedido for sobre exercicios/submissoes

Comece por:

- `api/src/routes/exercicios.route.ts`
- `api/src/routes/submissoes.route.ts`
- `web/src/pages/Exercises.tsx`
- `web/src/pages/ExerciseDetail.tsx`
- `web/src/services/api.ts`

### Se o pedido for sobre turmas/estrutura

Comece por:

- `api/src/routes/turmas.route.ts`
- `web/src/pages/Turmas.tsx`
- `web/src/pages/TurmaDetail.tsx`
- `web/src/pages/EstruturaCurso.tsx`

### Se o pedido for sobre materiais/video/upload

Comece por:

- `api/src/routes/materiais.route.ts`
- `api/src/routes/videoaulas.route.ts`
- `api/src/utils/uploadR2.ts`
- `web/src/pages/Materiais.tsx`
- `web/src/pages/VideoaulaBonus.tsx`


## O que evitar

- Nao mexer em schema do banco sem alinhamento.
- Nao assumir que toda rota existe apenas em `/api`.
- Nao quebrar a compatibilidade do socket de presenca.
- Nao duplicar componente de UI sem verificar `web/src/components/ui`.
- Nao trocar caracteres acentuados por escapes Unicode.
- Nao finalizar tarefa sem pelo menos buildar os modulos afetados.

