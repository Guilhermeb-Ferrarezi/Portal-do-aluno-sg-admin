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
