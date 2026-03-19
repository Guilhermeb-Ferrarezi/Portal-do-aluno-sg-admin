# Correcao 2026-03-19 (WebSocket reconnect loop em producao)

## Problema

WebSocket de presenca conecta em producao mas fecha imediatamente com code 1005 (no close frame) + wasClean: true, causando loop de reconexao infinito. Localmente funciona normalmente. Causa provavel: proxy externo (nginx host-level ou Cloudflare) que nao mantem a conexao WebSocket aberta.

## Ajustes aplicados

- **Servidor**: envia `{ type: "ping" }` imediatamente ao aceitar conexao WebSocket, ANTES de qualquer trabalho async (DB query). Isso forca dados a fluir pelo proxy o mais rapido possivel.
- **Cliente**: detecta padrao de "close imediato" (conexao durou < 5s). Apos 4 closes imediatos consecutivos, entra em modo HTTP-only (heartbeat via POST) e para de tentar WebSocket por 5 minutos.
- **Cliente**: apos periodo de fallback HTTP-only, tenta reconectar WebSocket novamente automaticamente.
- **Cliente**: log de close agora mostra duracao da conexao para diagnostico.

## Arquivos alterados

- `api/src/realtime/presence.ts` — ping imediato no connection handler
- `web/src/services/presenceSocket.ts` — deteccao de immediate close, fallback HTTP-only, retry automatico

## Investigacao pendente

O problema raiz provavelmente esta no proxy externo (fora do Docker). Verificar:
1. Se ha um nginx host-level no servidor que termina TLS e faz proxy para Docker — precisa ter `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"` e `proxy_read_timeout 3600s` na rota `/ws/`.
2. Se o dominio `painel-portaldoaluno.santos-tech.com` passa por Cloudflare proxy (nuvem laranja) — verificar se WebSocket esta habilitado no dashboard Cloudflare.
3. Se ha Cloudflare Tunnel (cloudflared) — verificar config do tunnel para WebSocket.

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
