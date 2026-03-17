# Correcao 2026-03-17

## Ajustes aplicados

- API agora aceita tanto as variaveis atuais (`JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `CORS_ORIGIN`) quanto as variantes usadas no `docker-compose` (`ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `ALLOWED_ORIGINS`, `IA_SG_ALLOWED_ORIGINS`).
- Login e refresh no backend passaram a aceitar o papel `aluno` (role `1`), alinhando auth com o restante da aplicacao.
- `requireRole()` deixou de bloquear professores em rotas marcadas como `admin` ou `professor`.
- O frontend ganhou `web/eslint.config.js`, destravando `npm run lint`.
- Corrigi os erros atuais de lint em `Dashboard.tsx`, `Login.tsx`, `ProfilePopup.tsx` e `Exercises.tsx`.
- Removi `MouseInteractiveBox.tsx` e `ShortcutTrainingBox.tsx`, que estavam sem uso no `web/src`.

## Validacao executada

- `api`: `npm run build`
- `web`: `npm run build`
- `web`: `npm run lint`
- `docker compose up -d --build`
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Pendencias observadas

- O lint ainda retorna 18 warnings antigos de hooks/fast-refresh, mas sem erros.
- O build do `web` ainda avisa que `backgroundLogin.png` e `backgroundLoginBranco.png` nao sao resolvidos em build time.

## Ajuste de presenca online

- Corrigi falso positivo de `Online` causado por socket zumbi no backend: `api/src/realtime/presence.ts` agora valida `pong` e encerra conexoes que nao respondem ao keepalive.
- Corrigi cache antigo de presenca no frontend: `web/src/services/presenceSocket.ts` agora limpa o snapshot em desconexao, reconexao e logout.
- A tela de usuarios foi ajustada em `web/src/pages/AdminUsers.tsx` para recarregar a lista quando o snapshot de presenca e resetado, evitando sobrepor o status correto vindo da API.
- Nao houve alteracao de tabela, coluna ou migracao de banco.
- Sincronizei as dependencias da API com `npm install` porque `ws` e `@types/ws` estavam ausentes no `api/node_modules`, apesar de constarem no `package.json`.

## Validacao do ajuste de presenca

- `api`: `npm run build`
- `web`: `npm run build`
- `web`: `npm run lint`
- `deploy_and_push.bat` executado em modo de teste, interrompido antes de qualquer push
- `docker compose ps` com `api`, `db` e `web` em execucao; `api` saudavel
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Ajuste complementar do WS em producao

- Ajustei a liveness do websocket de presenca em `api/src/realtime/presence.ts` para considerar atividade real da conexao, em vez de depender somente de `pong`.
- Agora o servidor mantem a conexao ativa quando recebe `presence:heartbeat` do navegador e so encerra sockets realmente parados apos a janela de seguranca.
- O objetivo foi evitar fechamento prematuro com codigo `1005` em ambientes com proxy/CDN, sem reintroduzir o falso positivo de usuario online.
- Nao houve alteracao de tabela, coluna ou migracao de banco.

## Validacao do ajuste complementar do WS

- `api`: `npm run build`
- `web`: `npm run build`
- `web`: `npm run lint`
- `deploy_and_push.bat` executado em modo de teste, interrompido antes de qualquer push
- `docker compose ps` com `api`, `db` e `web` em execucao; `api` saudavel
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`
