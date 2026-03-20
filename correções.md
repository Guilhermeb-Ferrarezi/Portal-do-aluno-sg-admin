# Correcao 2026-03-19 (Proxy interno de presence para o Portal Willian)

## Objetivo

Permitir que o `Portal willian/api` obtenha `socket-ticket` e atualize presence no `Portal-gui/api` sem depender de JWTs assinados pela mesma chave.

## Mudancas

- O backend do painel (`api/src/routes/presence.ts`) agora aceita autenticacao interna por `X-Presence-Proxy-Secret` so nas rotas de presence.
- O backend do `Portal willian/api` (`Controllers/PresenceController.cs`) passou a enviar `userId`, `usuario` e `roleId` para o painel usando esse segredo compartilhado.
- As envs dos dois projetos ganharam o segredo `PRESENCE_PROXY_SECRET` / `PortalPainel__PresenceProxySecret`.

## Efeito esperado

- `POST /api/presence/socket-ticket` no `Portal willian/api` deixa de retornar `502 Bad Gateway` por `401` do painel.
- O `Portal willian/web` passa a receber tickets validos emitidos pelo `Portal-gui/api`, permitindo abrir o WebSocket de presence sem polling HTTP.

# Correcao 2026-03-19 (Hardening do Nginx para WebSocket em producao)

## Objetivo

Reduzir casos em que o `GET /ws/presence` sobe com `101 Switching Protocols` em producao, mas a conexao fecha logo depois com `1005`.

## Mudancas

- O `web/nginx.conf` passou a usar `upstream api_upstream` fixo em vez de `proxy_pass` com variavel.
- O proxy agora usa `map $http_upgrade $connection_upgrade`, evitando forcar `Connection: upgrade` quando nao ha upgrade.
- As rotas `/api/` e `/ws/` receberam `proxy_socket_keepalive on`, `proxy_next_upstream off`, `proxy_read_timeout` e `proxy_send_timeout` altos.
- A rota `/ws/` tambem passou a ter `proxy_request_buffering off`.

## Ajuste complementar

- O `web/nginx.conf` voltou a resolver `api:3000` via `resolver 127.0.0.11` e `set $api_upstream`, evitando erro de boot `host not found in upstream "api:3000"` em ambientes onde o DNS do Docker ainda nao respondeu no parse inicial do Nginx.

## Efeito esperado

- Menos fechamentos prematuros de WebSocket em producao por comportamento do Nginx no caminho entre web e api.
- Menos chance de reconexao em loop com `1005` quando o socket de presence esta atras do proxy do `web`.

# Correcao 2026-03-19 (Presence ticket por query string para o Portal Willian)

## Objetivo

Evitar `401 Unauthorized` no WebSocket de presence do `Portal willian` quando o ticket nao era aproveitado corretamente no upgrade do socket.

## Mudancas

- O backend de presence (`api/src/realtime/presence.ts`) agora aceita o ticket de socket tambem via query string `?ticket=...`.
- O backend tambem aceita `?token=...` no upgrade como fallback local para autenticacao, quando o ticket nao for suficiente.
- O cliente do `Portal willian` (`web/src/composables/usePresence.ts`) passou a abrir o WS com o ticket na URL e manter apenas o protocolo principal `portal-aluno-presence.v1`.
- No ambiente loopback (`127.0.0.1`/`localhost`), o cliente do `Portal willian` tambem envia o token na query do WS.
- O fluxo antigo por subprotocolo continua aceito no backend para nao quebrar os clientes que ja estavam funcionando.

## Efeito esperado

- O `Portal willian` local deixa de receber `401` no `ws://127.0.0.1:3005/ws/presence`.
- O loop de `socket-ticket` por falha de autenticacao no upgrade some quando o ambiente local estiver reiniciado.

# Correcao 2026-03-19 (Presence 100% via WebSocket para last_seen_at)

## Objetivo

Parar de usar `POST /presence/heartbeat` como fallback continuo para atualizar `last_seen_at` e manter esse fluxo somente pelo WebSocket de presence.

## Mudancas

- Cliente de presence do painel (`web/src/services/presenceSocket.ts`) nao envia mais heartbeat HTTP.
- Quando o socket esta `OPEN`, o cliente continua enviando `presence:heartbeat` pelo proprio WS.
- Quando o socket cai, o cliente apenas agenda reconexao do WebSocket e nao faz mais `POST /presence/heartbeat` nesse intervalo.
- O fluxo do `Portal willan/web` recebeu o mesmo ajuste em `src/composables/usePresence.ts`, mantendo o comportamento alinhado entre os portais.

## Efeito esperado

- `last_seen_at` passa a ser atualizado so pelo canal WS.
- O painel de rede deixa de acumular `POST /presence/heartbeat` periodicos enquanto a sessao estiver ativa.
- Em caso de queda do WS, o cliente tenta reconectar e nao troca automaticamente para polling HTTP.

# Correcao 2026-03-19 (Presence ws-first com fallback HTTP)

## Objetivo

Parar de disparar `POST /presence/heartbeat` continuamente enquanto o WebSocket de presence estiver saudavel.

## Mudancas

- Cliente de presence (`web/src/services/presenceSocket.ts`) agora usa WebSocket como canal principal.
- Enquanto o socket estiver `OPEN`, o ciclo de heartbeat envia apenas `presence:heartbeat` pelo proprio WS.
- O heartbeat HTTP passa a rodar somente quando nao houver socket aberto.
- Depois de 4 fechamentos rapidos do socket em menos de 5 segundos, o cliente entra em modo HTTP-only por 5 minutos.
- Ao fim do cooldown, o cliente tenta reabrir o WebSocket automaticamente.

## Efeito esperado

- Menos trafego HTTP desnecessario quando o WebSocket estiver normal.
- Menos loop de reconexao agressivo quando o proxy matar o socket cedo demais.
- Presenca continua funcionando via HTTP quando o WS estiver instavel.

# Correcao 2026-03-19 (WebSocket reconnect loop em producao)

## Problema

Em producao, WebSocket de presenca conecta com sucesso (101 Switching Protocols) mas fecha imediatamente com **code 1005** (no close frame) + **wasClean: true**, causando loop de reconexao infinito durante ~30s ate dar erro. Localmente funciona normalmente. Causa raiz: **proxy externo** (nginx host-level ou similiar fora do Docker) nao mantem a conexao WebSocket aberta corretamente, provavelmente porque nao recebe dados rapidamente o suficiente na conexao.

## Contexto

Portal Willian Backend proxifica as requisicoes de `/presence` para Portal-do-aluno, mas nao faz WebSocket direto. O Frontend de Portal Willian tenta conectar ao WebSocket de Portal-do-aluno. Isso sugere que ambos projetos compartilham o mesmo proxy externo no host. Se Portal Willian consegue usar WebSocket normalmente, significa:
1. O proxy **suporta** WebSocket (nao esta bloqueando em nivel de protocolo)
2. O problema eh especifico da configuracao do Portal-do-aluno (roteamento, timeouts, ou como o servidor responde no upgrade)

## Ajustes aplicados

- **Servidor** (`api/src/realtime/presence.ts`): envia `{ type: "ping" }` **imediatamente** ao aceitar conexao, ANTES de qualquer work async (DB query). Forca dados a fluir pelo proxy o mais rapido possivel, evitando que o proxy ache a conexao "idle".
- **Cliente** (`web/src/services/presenceSocket.ts`): detecta pattern de "immediate close" (conexao durou < 5s). Apos 4 strikes, entra em **HTTP-only mode** (heartbeat via POST) e para de tentar WebSocket por 5 minutos, evitando loop infinito. Depois retenta automaticamente.
- **Cliente**: log de close mostra duracao da conexao para diagnostico futuro.

## Arquivos alterados

- `api/src/realtime/presence.ts` — ping imediato em `wss.on("connection")`
- `web/src/services/presenceSocket.ts` — constantes: `IMMEDIATE_CLOSE_THRESHOLD_MS=5000`, `IMMEDIATE_CLOSE_MAX_STRIKES=4`, `HTTP_ONLY_RETRY_WS_INTERVAL_MS=300000`; funcoes: `startHttpOnlyMode()`, deteccao em `scheduleReconnect()`, check em `connectPresenceSocket()`

## Teste e validacao

- API: `npm run build` — OK
- Web: `npm run build` — OK, warnings de assets conhecidos
- TypeScript check: `npx tsc --noEmit` — OK

## Investigacao se problema persistir

Se o WebSocket continuar caindo em producao mesmo apos deploy, verificar:
1. **Nginx host-level** (proxy TLS externo): precisa ter em `/ws/` location:
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_read_timeout 3600s;
   proxy_send_timeout 3600s;
   ```
2. **Cloudflare**: se o dominio passa por proxy Cloudflare (nuvem laranja), verificar se WebSocket esta habilitado em `Network` settings.
3. **Cloudflare Tunnel**: se usa `cloudflared`, verificar `config.yml` tem entrada para `/ws/` com `protocol: websocket`.
4. **Load balancer/WAF**: se ha um WAF ou load balancer na frente, pode estar blocando ou resetando conexoes WebSocket.

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

## Presenca em producao

### Ajustes aplicados

- O websocket de presenca no backend agora envia um snapshot dos usuarios online quando um cliente conecta ou reconecta, evitando tela com status defasado depois de reconexoes.
- O backend passou a mandar `ping` periodico no websocket para manter a conexao viva atras de proxy reverso.
- O `web/nginx.conf` agora define `proxy_read_timeout`, `proxy_send_timeout` e `proxy_buffering off` na rota `/ws/`, reduzindo quedas silenciosas de websocket no deploy.

### Validacao executada

- `api`: `npm run build`
- `web`: `npm run lint`
- `web`: `npm run build`
- `./deploy_and_push.bat` executado sem commit/push
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`
- Teste websocket via `ws://localhost:8080/ws/presence` com dois clientes sinteticos -> `onlineBroadcast=true`, `offlineBroadcast=true`, `reconnectSnapshot=true`

# Correcao 2026-03-18

## Ajustes aplicados

- A tela `AdminUsers` agora tem um botao de atualizar usuarios na barra de filtros, com icone e estado visual de carregamento.
- O recarregamento da listagem passou a manter a tabela visivel depois da primeira carga, evitando piscar a pagina inteira ao atualizar, salvar ou deletar usuarios.
- O footer do modal de edicao foi redesenhado com hierarquia melhor entre `Cancelar` e `Salvar alteracoes`, icones e estado de `Salvando...`.
- Durante o salvamento no modal, fechamento por `Esc`, clique fora e botao de fechar ficam bloqueados para evitar estado inconsistente.

## Validacao executada

- `api`: `npm run build`
- `web`: `npm run lint`
- `web`: `npm run build`
- `./deploy_and_push.bat` executado ate o fim do deploy e encerrado com `n` no passo de commit/push
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Pendencias observadas

- `web`: `npm run lint` continua com 18 warnings antigos de hooks/fast-refresh fora desta task, sem novos erros.

# Correcao 2026-03-18 (WebSocket Presenca)

## Ajustes aplicados

- Servidor agora envia mensagem `{ type: "ping" }` a nivel de aplicacao a cada 25s alem do `ws.ping()` de protocolo, garantindo que dados trafeguem pela conexao mesmo quando proxies (Cloudflare, Nginx, etc.) interceptam ping/pong de protocolo.
- Cliente responde com `{ type: "pong" }` ao receber o ping do servidor, mantendo a conexao ativa.
- Stale timeout do servidor aumentado de 70s para 90s para tolerar maior latencia antes de considerar o socket morto.
- Servidor agora usa `ws.close()` com codigo de aplicacao (4000/4001) ao invés de `ws.terminate()`, evitando desconexoes 1005 ("No Status Rcvd").
- Heartbeat do cliente reduzido de 30s para 25s para manter trafego mais frequente pelo proxy.
- Delay de reconexao do cliente reduzido de 5s para 3s para recuperacao mais rapida em caso de queda.

## Arquivos alterados

- `api/src/realtime/presence.ts` — keepalive com ping de aplicacao, stale timeout, close limpo
- `web/src/services/presenceSocket.ts` — resposta ao ping do servidor, intervalos ajustados

## Validacao executada

- `api`: `npx tsc --noEmit` sem erros
- `web`: `npx tsc --noEmit` sem erros
- Docker nao estava rodando para teste completo de deploy
