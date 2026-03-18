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

## Fallback de presenca para producao

- Adicionei um heartbeat HTTP autenticado em `api/src/routes/presence.ts` para atualizar `last_seen_at` mesmo quando o websocket estiver instavel no ambiente de producao.
- Extraí a persistencia de presenca para `api/src/presence/presenceStore.ts`, reutilizada pelo WS e pelo novo endpoint HTTP.
- O frontend em `web/src/services/presenceSocket.ts` agora envia heartbeat HTTP imediatamente ao iniciar a presenca e continua enviando em intervalo, mesmo durante reconexao do websocket.
- A pagina `web/src/pages/AdminUsers.tsx` ganhou polling a cada 30 segundos para refletir o status vindo do banco mesmo sem evento realtime.
- Nao houve alteracao de tabela, coluna ou migracao de banco.

## Validacao do fallback de presenca

- `api`: `npm run build`
- `web`: `npm run build`
- `web`: `npm run lint`

## Remocao do reload automatico em users

- Removi o polling de 30 segundos em `web/src/pages/AdminUsers.tsx`, entao a tela de usuarios nao recarrega mais sozinha por intervalo.
- A listagem continua recarregando apenas nos fluxos normais da pagina, como carga inicial, busca, filtros, paginacao e acoes manuais do usuario.
- Nao houve alteracao de tabela, coluna ou migracao de banco.

## Validacao da remocao do reload automatico

- `api`: `npm run build`
- `web`: `npm run lint`
- `web`: `npm run build`
- `deploy_and_push.bat` executado em modo de teste, sem commit nem push
- `docker compose ps` com `api` saudavel, `web` em execucao e `db` saudavel
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Endurecimento da autenticacao do WS de presenca

- Removi o envio do JWT na URL do websocket de presenca.
- O backend agora emite um ticket efemero e descartavel em `api/src/routes/presence.ts`, consumido apenas no handshake do WS.
- O upgrade do websocket em `api/src/realtime/presence.ts` passou a aceitar ticket via `Sec-WebSocket-Protocol`, rejeita `Origin` fora da allowlist e nao usa mais `?token=`.
- O frontend em `web/src/services/presenceSocket.ts` agora solicita o ticket autenticado via API antes de abrir o socket e conecta sem expor o JWT na URL.
- Adicionei `api/src/realtime/presenceTickets.ts` para controlar expiracao curta e uso unico dos tickets.
- Fiz um ajuste seguro de tipagem em `api/src/routes/submissoes.route.ts` para normalizar `req.params.exercicioId` e destravar o build atual da API.
- Nao houve alteracao de tabela, coluna ou migracao de banco.

## Validacao do endurecimento do WS

- `api`: `npm run build`
- `web`: `npm run build`

## Remocao da dependencia da tabela submissoes

- Confirmei no banco atual que `public.submissoes` nao existe mais e que o fluxo ativo usa a tabela `answer`.
- Adicionei `api/src/db/legacySubmissoes.ts` para detectar em runtime se a tabela legada ainda existe antes de qualquer query antiga.
- `api/src/routes/submissoes.route.ts` agora bloqueia escrita/correcao do fluxo legado com `410` quando `submissoes` nao existe e, nas leituras, entrega um retorno compativel a partir de `answer` em vez de consultar a tabela removida.
- `api/src/routes/exercicios.route.ts` agora so tenta apagar arquivos e registros de `submissoes` ao deletar exercicio se a tabela legada realmente existir.
- `web/src/pages/ExerciseDetail.tsx` foi ajustado para ficar no fluxo de `answers`, sem depender do import legado que apontava para `submissoes`.
- Nao houve alteracao de tabela, coluna ou migracao de banco.

## Validacao da remocao da dependencia de submissoes

- `api`: `npm run build`
- `web`: `npm run build`
- `web`: `npm run lint`
- `deploy_and_push.bat` executado em modo de teste, abortado antes de qualquer commit ou push
- `docker compose ps` com `api` saudavel, `web` em execucao e `db` saudavel
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Atualizacao da tela de usuarios so por websocket

- Removi o recarregamento da lista de usuarios quando o socket de presenca reseta em `web/src/pages/AdminUsers.tsx`.
- A tela agora atualiza o status online/offline localmente so pelos eventos `presence:hello` e `presence:update` do websocket.
- Quando o WS cai ou reconecta, os usuarios visiveis sao marcados como offline localmente ate o servidor reenviar o snapshot de presenca.
- Nao houve alteracao de tabela, coluna ou migracao de banco.

## Validacao da tela de usuarios por websocket

- `web`: `npm run build`
- `web`: `npm run lint`
- `deploy_and_push.bat` executado em modo de teste, abortado antes de qualquer commit ou push
- `docker compose ps` com `api` saudavel, `web` em execucao e `db` saudavel
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Broadcast de presenca tambem nos heartbeats

- Identifiquei que o backend so emitia `presence:update` ao conectar e desconectar o websocket.
- Nos heartbeats, ele atualizava `last_seen_at` no banco, mas nao notificava os outros clientes conectados, entao a tela de usuarios podia ficar sem refletir a atividade mais recente em tempo real.
- `api/src/realtime/presence.ts` agora faz broadcast de `presence:update` tambem quando um heartbeat do websocket realmente persiste um novo `last_seen_at`.
- `api/src/routes/presence.ts` agora faz o mesmo no fallback HTTP de presenca, para que os observadores recebam atualizacao mesmo quando a persistencia vier dessa rota.
- Nao houve alteracao de tabela, coluna ou migracao de banco.

## Validacao do broadcast de presenca nos heartbeats

- `api`: `npm run build`
- `web`: `npm run build`
- `web`: `npm run lint`
