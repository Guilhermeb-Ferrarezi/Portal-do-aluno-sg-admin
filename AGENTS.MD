# AGENTS.MD

Guia curto para qualquer agente trabalhando neste repositorio.
Leia isto primeiro. Para contexto mais completo, consulte `claude.md`.

## Objetivo do projeto

Portal do aluno com:

- `web/`: React 19 + Vite 7 + TypeScript + Tailwind 4 + shadcn/ui + Radix UI
- `api/`: Express 5 + TypeScript + PostgreSQL + JWT + WebSocket
- `docker-compose.yml`: sobe `web`, `api`, `db` e `db_proxy`

## Regras criticas

- Nao deixe bugs de caracteres especiais ou encoding.
- Nao crie nem altere tabelas/colunas sem aprovacao explicita do usuario.
- Se parecer que precisa de schema novo, primeiro verifique se o campo ja existe.
- Se faltar campo ou ajuste no banco, entregue o SQL/ajuste necessario para o usuario decidir.
- Nao exponha valores de `.env` nem replique segredos em resposta, commit ou documentacao.
- Ao adicionar uma rota nova, documente-a no swagger
- Ao terminar uma task, rode o deploy_and_push, mas sem commitar
- Rode os testes de playwright

## UI e frontend

- Sempre prefira componentes prontos de `shadcn` e `Radix UI`.
- Antes de criar algo do zero, verifique `web/src/components/ui`.
- Use context menus uteis, com acoes reais e coerentes com a tela.
- Preserve a linguagem visual existente: painel denso, cards fortes, glassmorphism leve e animacoes.
- Para chamadas autenticadas no frontend, prefira `apiFetch` e utilitarios existentes em `web/src/services/api.ts`.

## Backend e integracao

- Preserve compatibilidade de rotas com e sem prefixo `/api` quando seguir o padrao atual.
- Nao quebre o fluxo de presenca em tempo real:
  - `POST /presence/socket-ticket`
  - `POST /presence/heartbeat`
  - WebSocket em `/ws/presence` e `/api/ws/presence`
- Se alterar auth, revise backend e frontend juntos.

## Como trabalhar

- Primeiro localize com `rg` e abra so o trecho necessario.
- Evite ler inteiro arquivos grandes sem necessidade.
- Faca a menor mudanca consistente possivel.
- Se alterar contrato de API, atualize os tipos usados no frontend.

## Verificacao obrigatoria antes de concluir

- Backend: `cd api && npm run build`
- Frontend: `cd web && npm run lint && npm run build`
- Rode testes antes de concluir a task.
- Quando a mudanca afetar fluxo real, valide tambem com deploy local:
  - Linux/macOS: `./deploy_and_push.sh`
  - Windows: `./deploy_and_push.bat`
- Use o script apenas para teste/smoke test, sem commit ou push, a menos que o usuario peca.

## Hotspots

Leia com parcimonia estes arquivos grandes:

- `web/src/pages/Exercises.tsx`
- `web/src/pages/EstruturaCurso.tsx`
- `web/src/services/api.ts`
- `api/src/routes/exercicios.route.ts`
- `api/src/routes/turmas.route.ts`
- `api/src/routes/submissoes.route.ts`

## Arquivos de entrada uteis

- Auth: `api/src/routes/auth.ts`, `api/src/middlewares/auth.ts`, `web/src/auth/auth.ts`
- Presenca: `api/src/routes/presence.ts`, `api/src/realtime/presence.ts`, `web/src/services/presenceSocket.ts`
- App shell: `web/src/App.tsx`, `web/src/components/Dashboard/DashboardLayout.tsx`

Se houver conflito entre velocidade e seguranca, priorize nao quebrar auth, presenca, proxy e integracao com o banco existente.
