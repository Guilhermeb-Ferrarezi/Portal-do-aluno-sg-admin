# CLAUDE.md

## Objetivo deste arquivo

Este projeto e um portal do aluno com frontend React/Vite e backend Express/TypeScript.
Use este guia para trabalhar com mais velocidade, abrir menos arquivos desnecessarios e evitar regressao nos fluxos principais.

`AGENTS.MD` e o resumo operacional rapido.
Este arquivo e o contexto completo do repositorio.

## Skills locais do projeto

- Antes de planejar ou executar melhorias, refactors, backlog, roadmap, polimento de UX ou reducao de divida tecnica, leia e siga `skills/portal-improvement-sprints/SKILL.md`.
- Use `skills/portal-improvement-sprints/references/sprint-board.md` como fonte de verdade para priorizacao e acompanhamento dessas melhorias.
- Ao concluir um item dessa skill, atualize o checkbox correspondente e a linha `Progresso:` no mesmo commit.
- Se surgirem novas skills em `skills/*/SKILL.md`, aplique a skill relevante quando o pedido combinar com ela.

## Visao geral da stack

- `web/`
  - Vite 7
  - React 19
  - TypeScript
  - Tailwind 4
  - shadcn/ui
  - Radix UI
  - Framer Motion
- `api/`
  - Express 5
  - TypeScript
  - `pg`
  - JWT
  - `ws`
  - `zod`
  - upload para Cloudflare R2
- Infra local
  - `docker-compose.yml` sobe `web`, `api`, `db` e `db_proxy`
  - o `db_proxy` aponta para banco remoto existente e a API conversa com ele via `DATABASE_URL`
- Gerenciador de pacotes: `npm`
- Versao de Node esperada: 22.x

## Regras criticas do projeto

- Nunca crie ou altere tabelas/colunas sem aprovacao explicita do usuario.
- Se uma mudanca parecer exigir schema novo, primeiro verifique se o campo ja existe e depois documente o SQL/ajuste necessario para o usuario decidir.
- Nao assuma que migracoes criam schema. Hoje `api/src/db/migrations.ts` valida conectividade, nao estrutura.
- Nao exponha nem replique segredos de `.env` em respostas, commits ou documentacao.
- Nao deixe bugs de encoding, caracteres especiais ou texto corrompido.
- Sempre prefira usar componentes existentes de `shadcn`/`Radix` e os wrappers em `web/src/components/ui`.
- Antes de criar markup novo, confira se ja existe componente base, variante ou composicao reutilizavel.

## Comandos reais do projeto

### Desenvolvimento local por modulo

- API:
  - `cd api`
  - `npm install`
  - `npm run dev`
- Web:
  - `cd web`
  - `npm install`
  - `npm run dev`

### Verificacao minima

- Backend: `cd api && npm run build`
- Frontend: `cd web && npm run lint && npm run build`

Observacao:

- o build do frontend roda `check:text-escapes` antes do `vite build`
- hoje nao existe suite de testes automatizada no repositorio
- build + lint + smoke test sao a verificacao minima

### Stack completa com Docker

- `docker compose up -d --build`
- Frontend via compose: `http://localhost:8080`
- API via compose: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

### Script de smoke test/deploy local

- Linux/macOS: `./deploy_and_push.sh`
- Windows: `deploy_and_push.bat`

Regras para esse script:

- use para validar deploy local e smoke test
- nao faca commit ou push automatico, a menos que o usuario peca
- em Linux, o script tenta criar `.env` local com defaults se ele nao existir
- o script pode perguntar sobre `git pull`; para testes locais, nao sincronize nem publique nada sem necessidade

## Quando terminar uma task

Antes de concluir:

1. Rode o build da `api`.
2. Rode `lint` e `build` da `web`.
3. Se a mudanca afetar fluxo visivel, login, upload, presenca, proxy ou integracao entre modulos, rode tambem o smoke test com Docker.
4. Se o deploy local for relevante, use `./deploy_and_push.sh` ou `deploy_and_push.bat`, mas saia antes de commit/push.
5. Se nao foi possivel validar algo, declare explicitamente o que ficou sem testar.

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
  - validacao de conexao, nao cria schema
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
  - upload e delecao de arquivos no Cloudflare R2

### Frontend

- `web/src/App.tsx`
  - roteamento principal
  - lazy loading
  - controle global de sessao
  - conexao/desconexao do socket de presenca
- `web/src/auth/auth.ts`
  - tokens
  - refresh token
  - normalizacao de papel no `localStorage`
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
- `api/src/routes/exercicios/index.ts`
- `web/src/pages/EstruturaCurso.tsx`
- `api/src/routes/turmas.route.ts`
- `api/src/routes/submissoes.route.ts`
- `web/src/services/api.ts`

Para economizar contexto:

- primeiro use `rg -n "termo"` para localizar a funcao, rota ou estado certo
- depois abra so o trecho relevante com `sed -n 'inicio,fim p'`
- so leia o arquivo inteiro quando estiver refatorando a arquitetura daquela feature

## Convencoes importantes deste projeto

### API com e sem prefixo `/api`

O backend registra rotas em duas formas:

- sem prefixo, por exemplo `/auth/login`
- com prefixo `/api`, por exemplo `/api/auth/login`

Ao criar ou alterar endpoints, preserve a compatibilidade com os dois modos quando isso seguir o padrao existente.
O frontend normalmente usa `/api`.

### Vite proxy e nginx

Em desenvolvimento:

- `web/vite.config.ts` faz proxy de `/api` para `http://localhost:3000`
- `web/vite.config.ts` faz proxy de `/ws` para `ws://localhost:3000`

Em deploy containerizado:

- `web/nginx.conf` encaminha `/api/*` para a API
- `web/nginx.conf` faz bridge de `/ws/*` para `/api/ws/*`

Se alterar API, presenca ou websocket, revise tambem essas camadas de proxy.

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
- `web/nginx.conf`
- `web/vite.config.ts`

### Banco de dados

- O projeto usa schema existente.
- A conexao pode vir de `DATABASE_URL` ou `DB_SERVER`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`.
- No `docker-compose.yml`, a API aponta para `db_proxy:15432`.
- O `db_proxy` encaminha para um banco remoto configurado por variaveis de ambiente.
- Nao assuma que o container `db` local e a unica fonte de dados relevante.
- Verifique se o campo ja existe antes de propor schema novo.

### Uploads e arquivos

- Uploads relevantes passam por `api/src/utils/uploadR2.ts`.
- Alteracoes em materiais, videoaulas, badges, usuarios e submissoes podem depender desse utilitario.
- Ao mexer em upload, revise tambem a logica de delecao para nao deixar lixo no R2.

### Frontend e UI

- Mantenha a linguagem visual ja existente: painel denso, glassmorphism leve, cards fortes, sidebar elaborada e animacoes com Framer Motion.
- Reaproveite componentes em `web/src/components/ui` antes de criar markup novo.
- O projeto usa `components.json` com estilo `radix-nova`.
- O alias `@/*` aponta para `web/src/*`.
- Evite `fetch` cru para endpoints autenticados; prefira `apiFetch` e helpers em `web/src/services/api.ts`.
- Se precisar menu contextual, dropdown, dialog, select, tabs ou checkbox, procure primeiro implementacoes em `web/src/components/ui`.

## Fluxo recomendado para trabalhar com pouco contexto

1. Identifique se a mudanca e de `web`, `api` ou ambos.
2. Leia primeiro o arquivo de entrada da feature:
   - rotas: `api/src/server.ts` + arquivo em `api/src/routes/*`
   - auth: `web/src/auth/auth.ts` e `web/src/services/api.ts`
   - paginas: `web/src/App.tsx` + pagina em `web/src/pages/*`
3. Localize trechos com `rg` antes de abrir arquivos grandes.
4. Faca a menor mudanca consistente possivel.
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
- `api/src/routes/exercicios/index.ts`
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

### Se o pedido for sobre presenca em tempo real

Comece por:

- `api/src/routes/presence.ts`
- `api/src/realtime/presence.ts`
- `web/src/services/presenceSocket.ts`
- `web/src/App.tsx`
- `web/nginx.conf`
- `web/vite.config.ts`

## Checklist de revisao rapida antes de fechar uma mudanca

- O contrato de API mudou? Se sim, atualizou tipos e consumidores no frontend?
- A rota precisa existir com e sem `/api`?
- A mudanca tocou auth? Revisou token, refresh, role e guardas?
- A mudanca tocou presenca? Revisou HTTP, WS, proxy dev e nginx?
- A mudanca tocou upload? Revisou R2, delecao e URLs retornadas?
- A mudanca tocou UI? Reusou componentes existentes de `shadcn`/`Radix`?
- A mudanca pode sofrer com texto quebrado ou encoding?
- Rodou `api` build, `web` lint/build e, se necessario, smoke test com Docker?

## O que evitar

- Nao mexer em schema do banco sem alinhamento.
- Nao assumir que toda rota existe apenas em `/api`.
- Nao quebrar a compatibilidade do socket de presenca.
- Nao duplicar componente de UI sem verificar `web/src/components/ui`.
- Nao trocar `apiFetch` por `fetch` cru em fluxo autenticado.
- Nao concluir tarefa sem validar build, lint e smoke test proporcional ao impacto.
