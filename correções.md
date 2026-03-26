<<<<<<< Updated upstream
# Ajuste 2026-03-25 (deploy_and_push.sh no Linux local)

## Ajustes aplicados

- `deploy_and_push.sh` agora muda para a pasta do proprio script antes de executar, entao ele funciona mesmo quando chamado fora da raiz do repositorio.
- Quando o `.env` nao existe, o script cria automaticamente um arquivo local de desenvolvimento com `JWT_SECRET`, portas e credenciais alinhadas ao `docker-compose.yml`.
- O fluxo de git ficou menos agressivo para uso local: o script avisa quando ha alteracoes nao commitadas e pergunta separadamente se deve sincronizar com o remoto antes do deploy.
- A deteccao de Docker Compose agora aceita tanto `docker compose` quanto `docker-compose`, e a mensagem de erro no Linux passou a orientar exatamente como subir o daemon.

## Validacao desse ajuste

- `bash -n deploy_and_push.sh`
- `./deploy_and_push.sh` com o Docker desligado -> criou `.env` automaticamente e exibiu a orientacao `sudo systemctl enable --now docker`
- `docker compose config`
- Nao foi possivel validar `docker compose up -d --build` nesta task porque o daemon Docker estava inativo no host
=======
# Correcao 2026-03-26 (autoatualizacao do Electron via Cloudflare R2/CDN)

## Ajustes aplicados

- O wrapper `electron/` ganhou suporte a autoatualizacao com `electron-updater` usando provider `generic` apontado para `https://cdn.portaldoaluno.santos-tech.com/desktop/painel/win`.
- `electron/package.json` agora gera metadata de update (`latest.yml`) no build NSIS, inclui `electronUpdaterCompatibility >=2.16` e expoe o script `npm run publish:release`.
- Foi criado `electron/electron/update-service.ts`, que centraliza os eventos `checking-for-update`, `update-available`, `update-not-available`, `download-progress`, `update-downloaded` e `error`, mantendo `autoDownload=false` e `autoInstallOnAppQuit=false`.
- `electron/electron/preload.ts` passou a expor `window.desktop.updates` com `getState()`, `check()`, `download()`, `quitAndInstall()` e `subscribe(...)`.
- O frontend ganhou `web/src/types/desktop.ts` para tipar a bridge desktop no renderer.
- `web/src/components/SettingsOverlay.tsx` agora mostra a secao de atualizacoes apenas no Electron, com status atual, botao manual de verificar, card de progresso, confirmacao para baixar e confirmacao para reiniciar e instalar.
- Os prompts de download e reinicio ficam globais dentro do `SettingsOverlay`, entao o app pode avisar sobre update mesmo quando o painel de configuracoes estiver fechado.
- Foi criado `electron/scripts/publish-release.ts`, que roda o build desktop e envia `latest.yml`, instalador `.exe` e `.blockmap` para o bucket R2 usando a S3 API.
- O script de release aceita tanto as novas vars `R2_*` quanto as credenciais `CLOUDFLARE_*` ja existentes no `.env` raiz.
- `electron/.env.example`, `electron/README.md` e `electron/dev-app-update.yml` foram adicionados/atualizados para documentar o feed e a publicacao.

## Validacao executada

- `electron`: `npm install`
- `web`: `npm run build`
- `web`: `npm run lint` (0 erros; 16 warnings antigos de hooks/fast-refresh continuam no projeto)
- `electron`: `npx tsc --pretty false --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop scripts/publish-release.ts`
- `electron`: `npm run dist:win`
- artefatos gerados:
  - `electron/release/latest.yml`
  - `electron/release/Painel - Portal Santos Tech Setup 0.1.0.exe`
  - `electron/release/Painel - Portal Santos Tech Setup 0.1.0.exe.blockmap`
- execucao do binario `electron/release/win-unpacked/Painel - Portal Santos Tech.exe` com log em `%APPDATA%\\Painel - Portal Santos Tech\\main.log`

## Observacoes

- `deploy_and_push.bat` foi executado para a validacao final, mas abortou antes do deploy porque o Docker nao estava rodando nesta maquina no momento do teste.
- Com o Docker desligado, nao foi possivel subir o stack local nem validar `http://localhost:8080` e `http://localhost:3001` nesta task.
>>>>>>> Stashed changes

# Correcao 2026-03-20 (Ticket de presence vinculado ao cliente)

## Objetivo

Reduzir replay de `socket-ticket` em que um terceiro intercepta o ticket e tenta abrir o WebSocket de presence a partir de outro cliente.

## Mudancas

- O `Portal-gui/api` passou a salvar no ticket um fingerprint curto do cliente (`ip` e `user-agent`) em `api/src/realtime/presenceTickets.ts`.
- No upgrade do WebSocket, o painel agora compara o fingerprint atual com o fingerprint gravado no ticket antes de aceitar a conexao.
- A rota `POST /presence/socket-ticket` do painel passou a capturar esse fingerprint no momento da emissao.
- O `Portal willan/api` passou a repassar `X-Presence-Client-Ip` e `X-Presence-Client-User-Agent` do navegador ao solicitar o ticket ao painel, preservando a validacao mesmo com proxy interno.
- O fingerprint de IP agora normaliza aliases locais como `127.0.0.1` e `::1` para o mesmo valor de loopback, e tolera a troca entre enderecos privados locais e IP da bridge do Docker sem quebrar o ambiente local.

## Efeito esperado

- Alterar manualmente a conexao no Burp com um ticket de outra sessao deixa de ser suficiente para forcar um falso `online` quando o cliente origem for diferente.
- O fluxo legitimo continua funcionando para o painel e para o portal do Willian.

# Correcao 2026-03-19 (Escopo de visibilidade da presence no WebSocket)

## Objetivo

Evitar que qualquer cliente autenticado descubra pelo WebSocket os IDs reais de outros usuarios e o roster completo de quem esta online.

## Mudancas

- O backend de presence (`api/src/realtime/presence.ts`) agora guarda os metadados do usuario autenticado por socket.
- Mensagens `presence:hello` e `presence:update` deixaram de ser broadcastadas para toda conexao indiscriminadamente.
- Conexoes `admin` continuam recebendo a lista completa para alimentar a tela de gerenciamento de usuarios.
- Conexoes comuns passam a receber apenas o proprio estado de presence, sem lista global de usuarios online.

## Efeito esperado

- Um aluno ou professor autenticado nao consegue mais inferir pelo WebSocket quem mais esta online nem os IDs reais desses usuarios.
- A tela `AdminUsers` continua funcionando para admins, com status online/offline em tempo real.

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
- O cliente de presence do painel (`web/src/services/presenceSocket.ts`) passou a derivar o socket padrao em `/api/ws/presence`, aproveitando o mesmo prefixo `/api` que ja funciona em producao e evitando depender da rota separada `/ws/` no container `web`.
- A rota `/ws/` do `web/nginx.conf` ganhou um bridge de compatibilidade para bundles antigos: agora ela encaminha `/ws/...` para `/api/ws/...` no mesmo dominio, sem depender do hostname interno `api`.

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

# Correcao 2026-03-24

## Ajustes aplicados

- Backend ganhou `POST /api/exercicios/ai/generate` com auth, permissao para `admin/professor`, validacao por `zod`, rate limit dedicado, timeout e log de atividade.
- A geracao com Groq usa `fetch` no endpoint oficial com structured outputs em JSON schema estrito, resolve curso/modulo/fase canonicos no banco antes da chamada e valida a resposta de volta com `zod`.
- O schema novo de exercicios agora persiste multipla escolha em `question` e `question_option`, inclusive no update, sem criar colunas novas e sem apagar estrutura se ja existirem respostas vinculadas.
- O save do schema novo falha de forma explicita quando tentam salvar `gabarito` textual sem coluna existente em `public.exercise`, conforme a restricao de nao alterar o banco.
- O frontend ganhou um painel reutilizavel de IA com prompt, estado de loading/erro, bloqueio sem curso/modulo/fase e confirmacao antes de sobrescrever campos preenchidos.
- As duas UIs de criacao/edicao cobertas nesta task voltaram a exibir `gabarito` editavel para `escrita`, passaram a preencher `titulo`, `descricao`, `gabarito` ou `multiplaQuestoes` a partir da IA e agora enviam `multipla_regras` em formato `questoes` lowercase.
- A validacao de submissoes passou a aceitar tanto `questoes` quanto `Questoes` para manter compatibilidade com dados antigos.

## Validacao executada

- `api`: `npm run build`
- `web`: `npm run lint` (sem erros; warnings antigos de hooks/fast-refresh continuam no projeto)
- `web`: `npm run build`
- `./deploy_and_push.bat` executado e interrompido no primeiro prompt com `n`, sem pull/commit/push

## Atualizacao da mesma task

- O campo `gabarito` deixou de ser usado nas UIs de criacao de exercicios escritos. O frontend nao coleta mais esse conteudo e a geracao de rascunho por IA para `escrita` passou a preencher apenas `titulo` e `descricao`.
- O backend de exercicios agora ignora `gabarito` recebido no create/update e limpa o valor no save quando o schema permite, mantendo a multipla escolha intacta.
- A autocorrecao de respostas escritas no fluxo legado de `submissoes` passou a usar IA via Groq, retornando nota e feedback automaticos quando a resposta textual existe.
- Se a IA falhar ou estiver indisponivel, a submissao escrita ainda e salva, mas fica pendente para revisao manual em vez de bloquear o aluno.
- A heuristica `verificacaoDescricao` para respostas textuais passou a considerar o enunciado da atividade, sem depender de `gabarito`.

## Validacao complementar

- `api`: `npm run build`
- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh, sem erros novos)
- `web`: `npm run build`

## Atualizacao adicional da mesma task

- O gerador de rascunho com IA deixou de produzir texto descritivo de briefing no campo principal e passou a instruir explicitamente a Groq a devolver o enunciado/pergunta final para o aluno.
- O contrato do draft agora retorna tambem `difficulty` e `pointsRedeem`, ambos validados no backend antes de chegar ao frontend.
- As duas telas que usam o gerador agora aplicam automaticamente dificuldade e pontos de resgate no formulario, alem de incluir esses campos na confirmacao de sobrescrita.
- Os textos da UI do painel de IA foram ajustados para refletir que a IA preenche pergunta, dificuldade e pontos de resgate, nao apenas descricao.

## Validacao desta atualizacao

- `api`: `npm run build`
- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh, sem erros novos)
- `web`: `npm run build`
- `./deploy_and_push.bat` executado com respostas `s`, `s`, `n`, concluindo deploy e encerrando antes de commit/push
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Ajuste adicional do gerador de pergunta

- O backend do draft com Groq passou a exigir que o campo principal venha em formato de pergunta real, terminando com `?`, em vez de aceitar enunciados descritivos no imperativo.
- Foi adicionada uma validacao extra no schema do draft para rejeitar respostas como `Crie`, `Desenvolva`, `Escreva` e similares quando o campo principal nao estiver em formato interrogativo.
- A geracao agora faz uma segunda tentativa automatica com instrucao mais rigida quando a primeira resposta da Groq vier como descricao/enunciado em vez de pergunta.
- Os textos da UI do gerador foram ajustados para deixar explicito que a IA deve preencher uma pergunta direta.

## Validacao desse ajuste

- `api`: `npm run build`
- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh, sem erros novos)
- `web`: `npm run build`
- `./deploy_and_push.bat` executado com respostas `s`, `s`, `n`, concluindo deploy e encerrando antes de commit/push
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Ajuste de modelo Groq para plano free

- A correcao escrita em `submissoes.route.ts` deixou de ter modelo hardcoded e agora le `GROQ_CORRECTION_MODEL` do ambiente, com fallback para `GROQ_MODEL` apenas se essa variavel especifica nao estiver definida.
- Foi configurado `GROQ_CORRECTION_MODEL=llama-3.1-8b-instant` no `.env` da raiz e no `api/.env`, reduzindo custo e consumo de quota para o Free Plan.
- A rota de correcao agora usa `json_schema` estrito apenas para modelos `gpt-oss`; para modelos mais leves como `llama-3.1-8b-instant`, ela usa `json_object` e continua validando a resposta com `zod` no backend.
- O limite de saida da correcao escrita foi reduzido para `250` completion tokens e o prompt passou a exigir feedback curto, para economizar quota no Free Plan.
- O `docker-compose.yml` passou a expor explicitamente `GROQ_CORRECTION_MODEL` para o container da API.

## Validacao desse ajuste de modelo

- `api`: `npm run build`
- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh, sem erros novos)
- `web`: `npm run build`
- `./deploy_and_push.bat` executado com respostas `s`, `s`, `n`, concluindo deploy e encerrando antes de commit/push
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

# Correcao 2026-03-25 (Tailwind + Radix + shadcn/ui no login)

## Objetivo

Preparar o frontend para uso de `Tailwind CSS`, `Radix` e `shadcn/ui`, e migrar a tela de login inteira para a nova base sem depender mais de `Login.css`.

## Mudancas

- O frontend passou a incluir `tailwindcss`, `@tailwindcss/vite`, `shadcn`, `radix-ui`, `tw-animate-css`, `class-variance-authority`, `clsx` e `tailwind-merge` em `web/package.json`.
- O build do Vite agora carrega o plugin do Tailwind e o alias `@` foi configurado em `web/vite.config.ts`, `web/tsconfig.json` e `web/tsconfig.app.json`.
- Foi adicionada a base do `shadcn/ui` com `web/components.json`, `web/src/styles/globals.css`, `web/src/lib/utils.ts` e os componentes `ui/button`, `ui/card`, `ui/input` e `ui/label`.
- A tela `web/src/components/Login/Login.tsx` foi reescrita para usar Tailwind + shadcn, mantendo o fluxo de auth, toggle de senha, countdown de redirecionamento, toasts e overlay de carregamento.
- O arquivo legado `web/src/components/Login/Login.css` foi removido, porque a tela de login passou a ser 100% estilizada por classes utilitarias.
- O `docker-compose.yml` tinha um caractere solto antes de `PORT: 3000` na API; o typo foi removido para permitir validacao do deploy local.

## Validacao executada

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose config -q`
- `docker compose up -d --build`
- `docker compose ps`
- `GET http://localhost:3001/api/health` -> `200`
- `GET http://localhost:8080` -> `200`

## Ajuste visual complementar

- O cabecalho do login foi alinhado corretamente em `web/src/components/Login/Login.tsx`, ajustando o `CardHeader` do shadcn para `grid` centralizado em vez de classes pensadas para `flex`.
- A badge `Santos Tech`, o logo e o bloco de titulo/subtitulo agora compartilham o mesmo eixo central, evitando o efeito de badge esticada e logo puxado para a esquerda.

## Validacao do ajuste visual

- `web`: `npm run build`

## Atualizacao complementar 2026-03-25 (Modal, ConfirmDialog e Pagination)

- `web/src/components/Modal.tsx` foi migrado para `Radix Dialog` com base shadcn, mantendo a API publica atual (`isOpen`, `onClose`, `title`, `footer`, `size`, `closeOnEscape`, `closeOnBackdropClick`).
- Foi adicionado `web/src/components/ui/dialog.tsx` para centralizar a base de dialogos reutilizaveis do app em Tailwind/shadcn.
- `web/src/components/ConfirmDialog.tsx` deixou de depender de `ConfirmDialog.css` e passou a usar `Modal` + `Button` do shadcn com variacao normal/perigosa.
- `web/src/components/Pagination.tsx` deixou de depender de `Pagination.css` e passou a usar classes utilitarias, `Button` e `Input`, preservando a mesma interface de props.
- Os arquivos legados `web/src/components/Modal.css`, `web/src/components/ConfirmDialog.css` e `web/src/components/Pagination.css` foram removidos.

## Validacao dessa atualizacao complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste visual complementar 2026-03-25 (context menu no nome do holder)

- O `context menu` tambem foi aplicado no bloco do nome do usuario em `web/src/pages/Medalhas.tsx`, dentro da secao `Quem tem medalhas`, que era o ponto desejado para a interacao contextual.
- Nesse menu, o usuario pode ser buscado rapidamente na lista, ter o contato copiado e, para admin, ser adicionado direto na area de atribuicao.
- O chip de usuario selecionado na area de atribuicao tambem foi reduzido para um tamanho mais proporcional ao restante do layout.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste visual complementar 2026-03-25 (AdminUsers em lista compacta)

- A listagem de `web/src/pages/AdminUsers.tsx` saiu do layout de cards altos e passou para um formato compacto em linhas, com colunas para `Usuario`, `Papel`, `Status` e `Ultima atividade`, aproximando a tela do padrao de tabela leve desejado.
- O clique direito agora atua sobre a linha inteira do usuario, com `context menu` mais proximo do fluxo esperado: `Editar usuario`, `Copiar contato`, `Enviar email`, submenu `Alterar papel` e `Deletar usuario`.
- A troca de papel no submenu passou a usar `atualizarUsuario(..., { role })`, que ja e suportado pela API do projeto.
- O texto de ultima atividade foi resumido para formato relativo (`Agora`, `2h atras`, `3 dias atras`), deixando a leitura mais proxima da referencia visual.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`

## Ajuste visual complementar 2026-03-25 (toast fora do conteudo e topo simplificado em AdminUsers)

- `web/src/components/animate-ui/AnimatedToast.tsx` passou a usar `createPortal` para o modo flutuante `top-right`, garantindo que o toast nao fique preso a containers com transformacao ou dentro do conteudo da pagina.
- O topo de `web/src/pages/AdminUsers.tsx` foi simplificado: sairam o bloco `Operacao de usuarios` e os cards de resumo, incluindo o de `Paginacao`, mantendo apenas busca, filtro e acao de atualizar.
- Com isso a tela ficou mais limpa e o foco visual voltou para a lista de usuarios.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`

## Ajuste visual complementar 2026-03-25 (medalhas com filtro e paginacao na atribuicao)

- A coluna `Medalha` da area de atribuicao em `web/src/pages/Medalhas.tsx` foi reorganizada para um painel de resultados filtrados com paginacao, em vez do bloco expansivel com scroll longo.
- Agora a busca por medalha filtra toda a base e a lista mostra poucos itens por vez, usando o componente de paginacao ja padronizado no projeto.
- O estado selecionado da medalha foi mantido no mesmo fluxo, mas a visualizacao ficou mais estavel e proporcional entre as duas colunas da atribuicao.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste visual complementar 2026-03-25 (submenu de medalhas no context menu)

- O context menu do nome do holder em `web/src/pages/Medalhas.tsx` passou a usar um submenu `Medalhas`, no estilo `Mais >`, em vez de exibir a acao de expandir diretamente na raiz do menu.
- Dentro desse submenu ficaram as acoes relacionadas ao bloco: `Expandir/Recolher medalhas` e, para admin, `Adicionar a atribuicao`.
- Esse ajuste foi feito para aproximar o comportamento do padrao visual de submenu esperado e reduzir a sensacao de menu "seco" com acoes desconectadas.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste visual complementar 2026-03-25 (lista expansivel de medalhas na atribuicao)

- A coluna `Medalha` em `web/src/pages/Medalhas.tsx` deixou de listar itens abertos o tempo todo e passou a usar um controle de `Expandir/Recolher medalhas`, reduzindo o overflow e equilibrando melhor a altura entre as colunas da atribuicao.
- Ao digitar no campo de medalha, a lista abre automaticamente; ao selecionar uma medalha, ela fecha novamente.
- No `context menu` do nome do holder, a opcao pouco util de `Buscar este usuario` foi substituida por `Expandir/Recolher medalhas`, alinhando a acao ao comportamento real esperado nesse bloco.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`

## Ajuste visual complementar 2026-03-25 (context menu de usuarios sem filtro embutido)

- O `context menu` da tela `web/src/pages/AdminUsers.tsx` deixou de incluir a acao de filtro por role, para ficar restrito a acoes do proprio item.
- Os chips informativos do rodape dos cards de usuario foram removidos, reduzindo altura e ruído visual.
- O card passou a manter apenas a acao visivel de `Editar`; a exclusao continua disponivel pelo `context menu`, evitando excesso de botoes no layout.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Atualizacao complementar 2026-03-25 (Medalhas em Tailwind)

- `web/src/pages/Medalhas.tsx` foi migrada para Tailwind, removendo a dependencia completa de `Medalhas.css` e preservando listagem, filtros, cards, paginação, holders agrupados, atribuição em lote, biblioteca de imagens, criação/edição e modal de edição.
- A aba `ver` agora usa cards e painéis na mesma linguagem visual aplicada nas telas já migradas, com estados vazios/loading em Tailwind e ações administrativas padronizadas.
- O bloco de holders foi refeito com acordeão visual utilitário, filtros consistentes e ações de salvar/remover alinhadas à nova base.
- As abas `imagens` e `criar` passaram a usar cards utilitários, preview de ícone em Tailwind e file input visual sem depender mais de classes legadas.
- O arquivo legado `web/src/pages/Medalhas.css` foi removido.

## Validacao dessa atualizacao complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `GET http://localhost:8080` -> `200`

## Ajuste visual complementar 2026-03-25 (atribuicao de medalhas)

- O bloco de atribuicao em `web/src/pages/Medalhas.tsx` passou a sugerir medalhas logo ao abrir o campo, evitando a coluna vazia enquanto nenhuma busca e digitada.
- A selecao da medalha agora aparece tambem como chip removivel, espelhando o comportamento dos usuarios selecionados e deixando mais claro o estado atual da atribuicao.
- Foram adicionados estados vazios para busca sem resultado e um rodape de resumo com CTA mais explicito, inclusive com aparencia desabilitada mais evidente quando ainda falta usuario ou medalha.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Atualizacao complementar 2026-03-25 (context menu em usuarios selecionados)

- Foi adicionado `web/src/components/ui/context-menu.tsx` via `shadcn/ui` para suportar interacoes de clique direito no frontend.
- Os chips de usuario selecionado na area de atribuicao de `web/src/pages/Medalhas.tsx` agora abrem um `context menu` ao clicar com o botao direito.
- O menu inclui acoes para manter somente aquele usuario na selecao, copiar email/login quando existir e remover o usuario da selecao sem depender apenas do clique comum no chip.

## Validacao dessa atualizacao complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste visual complementar 2026-03-25 (campo de busca em VideoaulaBonus)

- O campo de busca da tela `web/src/pages/VideoaulaBonus.tsx` recebeu mais espaco interno a esquerda (`pl-14`) e o container do icone foi fixado com largura propria, evitando que o placeholder encoste ou sobreponha o icone de busca.

## Validacao do ajuste visual complementar

- `web`: `npm run build`

## Refinamento visual complementar 2026-03-25 (VideoaulaBonus)

- A tela `web/src/pages/VideoaulaBonus.tsx` recebeu uma segunda passada visual para harmonizar melhor com a nova base Tailwind: painel de filtros com superficie mais consistente, estados de loading/erro/vazio na mesma linguagem e cards com acabamento mais limpo.
- O campo de busca manteve o ajuste de espacamento do icone, e o bloco de filtros passou a usar uma superficie mais intencional em vez de um card plano.
- Os cards de videoaula receberam ajuste fino de espacamento interno e camada visual sutil para reduzir o aspecto "seco" da primeira migracao.

## Validacao desse refinamento visual

- `web`: `npm run build`

## Atualizacao complementar 2026-03-25 (Materiais em Tailwind)

- `web/src/pages/Materiais.tsx` foi reescrita para Tailwind, removendo a dependencia completa de `Materiais.css` e preservando filtros, cards, paginacao, upload de arquivo, cadastro por link, exclusao e atribuicao de turmas.
- A tela passou a usar a mesma base visual aplicada em `VideoaulaBonus`: painel de filtros em card, estados de loading/erro/vazio em Tailwind, badges de acesso por turma e cards com acao principal/delecao padronizadas.
- O modal de criacao de material foi migrado para a nova base com campos utilitarios, selecao de tipo `arquivo/link`, seletor de formato de arquivo e file picker visual em Tailwind.
- O arquivo legado `web/src/pages/Materiais.css` foi removido.

## Validacao dessa atualizacao complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `GET http://localhost:8080` -> `200`

## Hotfix 2026-03-25 (icone sobrepondo placeholder nas buscas)

- Os campos de busca em `web/src/pages/VideoaulaBonus.tsx` e `web/src/pages/Materiais.tsx` passaram a forcar `padding-left` explicito para evitar que o icone de lupa sobreponha o placeholder.
- O problema vinha do padding base reutilizado no campo utilitario, que neste contexto estava prevalecendo sobre o ajuste especifico do input de busca.

## Validacao desse hotfix

- `web`: `npm run build`

## Refactor 2026-03-25 (PaginatedSelect em Tailwind)

- `web/src/components/PaginatedSelect.tsx` deixou de depender de `PaginatedSelect.css` e passou a usar utilitarios Tailwind com `cn`.
- O seletor manteve a mesma API publica (`value`, `onChange`, `options`, `selectedOption`, `remote`, paginação local/remota e `pageSize`), mas agora concentra toda a estrutura visual no proprio componente.
- O trigger, o painel, a busca interna, os cards de resultado, o estado vazio/loading e o pager `Ant / Prox` foram reescritos na nova base visual.
- O componente agora tambem fecha com `Escape`, continua fechando ao clicar fora e preserva o comportamento responsivo sem depender de media queries em arquivo CSS.
- O arquivo legado `web/src/components/PaginatedSelect.css` foi removido.

## Validacao desse refactor

- `web`: `npm run lint` (16 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Hotfix 2026-03-25 (confirmacao extra condicional em CreateUser)

- `web/src/components/Dashboard/Sidebar/CreateUser/CreateUser.tsx` passou a exibir o bloco de confirmacao extra apenas quando o cargo selecionado e `Administrador`.
- A linha de `Cargo` agora volta para coluna unica quando o papel escolhido nao exige senha administrativa, evitando reservar espaco vazio no layout.

## Validacao desse hotfix

- `web`: `npm run build`

## Refactor 2026-03-25 (ProfilePopup em Tailwind)

- `web/src/components/ProfilePopup.tsx` foi migrado para Tailwind e deixou de depender de `ProfilePopup.css`.
- O popup manteve portal, animação com `framer-motion`, banner com capa customizada, avatar, badge de role, informacoes da conta e acao de abrir configuracoes.
- O posicionamento agora tambem reage a `resize` e `scroll`, com clamp horizontal no desktop e fallback fixo no mobile, evitando que o popup escape da viewport.
- O estado da capa continua sincronizado pelos eventos de cover, mas o `useMemo` antigo foi removido, eliminando um warning de lint desnecessario nesse componente.
- O arquivo legado `web/src/components/ProfilePopup.css` foi removido.

## Validacao desse refactor

- `web`: `npm run lint` (os warnings antigos do projeto cairam de 17 para 16; sem erros novos)
- `web`: `npm run build`

## Hotfix 2026-03-25 (API do Docker usando banco remoto)

- O serviço `api` em `docker-compose.yml` estava herdando `DATABASE_URL` do arquivo `.env`, o que fazia o container tentar subir apontando para o banco remoto em vez do serviço `db` do compose.
- O compose agora sobrescreve explicitamente `DATABASE_URL`, `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `DB_SSL` para usar o banco local do stack Docker.
- Com isso, a API voltou a iniciar o processo de migração localmente, conectar no `db` do compose e responder no healthcheck.

## Validacao desse hotfix

- `docker compose config`
- `docker compose up -d --build api`
- `docker compose ps`
- `GET http://localhost:3001/api/health` -> `{"ok":true}`
- `docker compose up -d web`
- `GET http://localhost:8080` -> `200`

## Ajuste complementar 2026-03-25 (Docker apontando para o banco remoto via proxy local)

- O banco local do compose estava vazio, entao a API conectava mas o dashboard seguia quebrando por falta de tabelas como `class`, `user`, `exercise` e `enrollment`.
- Foi adicionado `scripts/remote-db-proxy.js`, um proxy TCP simples em Node para expor no host uma porta local que encaminha para o Postgres remoto configurado no `.env`.
- `docker-compose.yml` foi ajustado para o servico `api` usar `guilherme_whatsapp-db:${DOCKER_DB_PROXY_PORT:-15432}`, aproveitando o `host-gateway` ja configurado.
- O proxy foi iniciado no host e a API passou a enxergar, de dentro do proprio container, as tabelas reais do banco remoto.

## Validacao desse ajuste complementar

- `Test-NetConnection 212.28.182.72 -Port 15500` -> `TcpTestSucceeded : True`
- `Test-NetConnection localhost -Port 15432` -> `TcpTestSucceeded : True`
- `docker compose exec -T api node -` consultando `information_schema.tables` -> tabelas reais encontradas (`class`, `badge`, `container_tasks`, etc.)
- `docker compose up -d --build api web`
- `docker compose ps` -> `api` healthy e `web` up

## Hotfix 2026-03-25 (largura do select em CreateUser)

- O campo `Cargo` em `web/src/components/Dashboard/Sidebar/CreateUser/CreateUser.tsx` passou a usar `w-full`.
- Isso corrige o caso em que o `select` encolhia ao tamanho do texto enquanto o icone de seta continuava preso ao limite direito do wrapper, deixando o campo visualmente quebrado.

## Validacao desse hotfix

- `web`: `npm run build`

## Refinamento 2026-03-25 (cards de medalhas compactados)

- `web/src/pages/Medalhas.tsx` teve os cards da grade principal compactados com menos padding, icone menor, descricao mais curta visualmente, chips mais leves e acoes de `Editar/Excluir` reduzidas.
- O objetivo foi remover a sensacao de "vazio" no rodape dos cards e deixar a leitura mais proporcional na grade.

## Validacao desse refinamento

- `web`: `npm run build`

## Ajuste 2026-03-25 (atribuicao de medalhas em lote)

- `web/src/pages/Medalhas.tsx` deixou de tratar a selecao de medalha como item unico na area de atribuicao.
- O seletor agora adiciona medalhas a uma lista de chips removiveis, permitindo enviar varias medalhas para os usuarios selecionados em uma unica acao.
- O card grande de medalha selecionada foi removido e substituido por chips compactos, reduzindo o desnivel visual entre as colunas `Usuario` e `Medalha`.

## Validacao desse ajuste

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste 2026-03-25 (fallback mobile para context menus)

- Foi adicionado `web/src/components/ui/dropdown-menu.tsx` via shadcn para servir como menu de acoes tocavel no mobile.
- `web/src/pages/AdminUsers.tsx` agora mostra um botao de acoes no celular em cada linha de usuario, mantendo o `ContextMenu` no desktop.
- `web/src/pages/Medalhas.tsx` ganhou o mesmo fallback nos cards de holders e nos chips de usuarios selecionados na area de atribuicao.
- Com isso, as acoes que antes dependiam de clique direito agora tambem podem ser acessadas por toque em telas pequenas.

## Validacao desse fallback mobile

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Atualizacao complementar 2026-03-25 (ConfirmModal e VideoaulaBonus)

- `web/src/components/ConfirmModal.tsx` deixou de depender de `ConfirmModal.css` e passou a usar portal + Tailwind + `Button` do shadcn, mantendo as props publicas (`isOpen`, `title`, `message`, `onConfirm`, `onCancel`, `danger`, `isLoading` e `overlayZIndex`).
- `web/src/pages/VideoaulaBonus.tsx` foi reescrita para Tailwind, removendo a dependencia completa de `VideoaulaBonus.css` e preservando busca, filtros, cards, modal de player, modal de upload, toasts, paginacao e fluxo de exclusao.
- A tela agora usa uma composicao mais consistente com a nova base visual: filtros em card, cards com hover utilitario, estado vazio/error em Tailwind e formularios de modal alinhados ao design system atual.
- O formulario de criacao passou a expor tambem a opcao `Vimeo`, que ja era suportada pela logica existente da pagina.
- O label lateral em `web/src/components/Dashboard/DashboardLayout.tsx` foi ajustado para `Videoaulas Bonus`, evitando texto quebrado nessa rota.
- Os arquivos legados `web/src/components/ConfirmModal.css` e `web/src/pages/VideoaulaBonus.css` foram removidos.

## Validacao dessa atualizacao complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`

## Wrapper Electron 2026-03-26 (renderer vindo da pasta web, wrapper em TS)

- Foi criada a pasta `electron/` como wrapper Electron em TypeScript, sem duplicar a aplicacao de `web/`.
- O frontend continua vindo de `web/`: em desenvolvimento o Electron abre o Vite de `../web`, e no build a pasta `electron/renderer-dist` e gerada a partir de `web/dist`.
- O processo principal ficou em `electron/electron/main.ts`, com servidor local para servir `renderer-dist` e fazer proxy de `/api` e `/ws`.
- O preload ficou em `electron/electron/preload.ts`.
- O script `electron/scripts/sync-renderer.ts` sincroniza o build pronto de `web/dist` para `electron/renderer-dist`.
- O `electron-builder` foi configurado para empacotar `dist-electron/` e `renderer-dist/`, com `signAndEditExecutable: false` para evitar a falha de privilegio de symlink no Windows durante a validacao local.

## Validacao do wrapper Electron

- `electron`: `npm install`
- `electron`: `npm run build`
- `electron`: `npx electron-builder --dir`

## Ajuste de funcionamento 2026-03-26 (wrapper Electron abrindo de fato)

- O wrapper estava falhando ao abrir porque o ambiente local tinha `ELECTRON_RUN_AS_NODE=1`, o que fazia `electron .` iniciar em modo Node e quebrar o acesso a `app.whenReady()`.
- Os scripts de `electron/package.json` agora limpam essa variavel antes de abrir o Electron em `dev` e `start`.
- O fallback padrao do proxy do wrapper passou a apontar para `https://painel-portaldoaluno.santos-tech.com`, evitando dependencia obrigatoria de API local para a versao desktop abrir e operar.
- `electron/electron/main.ts` ganhou logs de startup/carga do renderer para facilitar depuracao do wrapper desktop e confirmar a subida do servidor local que entrega `renderer-dist`.

## Validacao desse ajuste de funcionamento

- `electron`: `npm run build:wrapper`
- `electron`: `npm run start` (wrapper ficou de pe e registrou carga do renderer local em `%APPDATA%\\portal-do-aluno-electron\\main.log`)
- `electron`: `npm run build`
- `electron`: `npx electron-builder --dir`
- `https://painel-portaldoaluno.santos-tech.com/api/health` -> `200`

## Correcao 2026-03-26 (erro 405 no proxy do Electron)

- O proxy local do wrapper Electron estava montado em `/api` e `/ws`, mas sem reescrever o path antes de encaminhar.
- Com isso, requisicoes como `/api/auth/login` chegavam no backend como `/auth/login`, causando `405` em vez da resposta correta da API.
- `electron/electron/main.ts` agora reescreve:
  - `/api/*` -> `/api/*`
  - `/ws/*` -> `/api/ws/*`
- Isso alinha o wrapper ao mesmo contrato usado pelo `nginx.conf` do projeto web.

## Validacao dessa correcao

- `electron`: `npm run build:wrapper`
- `electron` em execucao local: `GET http://127.0.0.1:4173/api/health` -> `200`
- `electron` em execucao local: `POST http://127.0.0.1:4173/api/auth/login` com credenciais invalidas -> `401`

## Personalizacao 2026-03-26 (nome e icone do app Electron)

- O wrapper Electron foi renomeado para `Painel - Portal Santos Tech`.
- `electron/package.json` agora usa:
  - `name`: `painel-portal-santos-tech`
  - `description`: `Painel - Portal Santos Tech em Electron usando a pasta web como renderer.`
  - `build.productName`: `Painel - Portal Santos Tech`
  - `build.win.executableName`: `Painel - Portal Santos Tech`
  - `build.win.icon`: `assets/icon.png`
- `electron/electron/main.ts` passou a definir o titulo da janela com `Painel - Portal Santos Tech` e usar o icone local em `electron/assets/icon.png`.
- O arquivo `electron/assets/icon.png` foi criado a partir de `web/public/faviconPreto.png`.

## Validacao dessa personalizacao

- `electron`: `npm run build`
- `electron`: `npx electron-builder --dir`
- executavel gerado: `electron/release/win-unpacked/Painel - Portal Santos Tech.exe`

## Refactor 2026-03-25 (Dashboard e shell em Tailwind/shadcn)

- `web/src/components/Dashboard/DashboardLayout.tsx` deixou de depender de `Dashboard.css` e foi refeito com utilitarios Tailwind para sidebar, topbar, overlay mobile, bloco de perfil e navegacao administrativa.
- O modal de selecao de turma do shell saiu do overlay manual e passou a usar `Dialog` do shadcn, mantendo o fluxo de escolha para alunos com mais de uma turma.
- `web/src/components/Dashboard/Dashboard.tsx` foi migrado para Tailwind/shadcn com `Card`, `Button`, `Badge`, `Separator` e `Skeleton`, cobrindo loading, erro, resumo operacional, cards metricos, lista de exercicios recentes, progresso e acoes rapidas.
- O arquivo legado `web/src/components/Dashboard/Dashboard.css` foi removido.
- Foram adicionados os componentes `web/src/components/ui/badge.tsx`, `web/src/components/ui/separator.tsx` e `web/src/components/ui/skeleton.tsx` para sustentar essa camada nova sem CSS avulso.

## Validacao desse refactor

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste visual 2026-03-25 (alinhamento da atribuicao de medalhas)

- `web/src/pages/Medalhas.tsx` passou a usar a mesma estrutura de campo no bloco de `Medalha` e no bloco de `Usuario` dentro da atribuicao em lote.
- O espaco extra criado por um wrapper com `min-h-6` no rotulo da medalha foi removido, fazendo o `PaginatedSelect` subir e alinhar corretamente com o input de busca de usuario.

## Validacao desse ajuste visual

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`

## Ajuste visual e novo refactor 2026-03-25 (Medalhas + CreateUser)

- A area de atribuicao em `web/src/pages/Medalhas.tsx` foi reorganizada para alinhar melhor as colunas de `Usuario` e `Medalha`: o cabecalho da direita deixou de carregar o botao de limpar, e a acao `Limpar medalhas` passou a acompanhar os chips de selecao.
- Quando nenhuma medalha esta selecionada, o lado direito agora mostra um helper curto no mesmo bloco, em vez de um cabecalho assimetrico.
- `web/src/components/Dashboard/Sidebar/CreateUser/CreateUser.tsx` foi migrado inteiro para Tailwind/shadcn, preservando validacao, checagem de e-mail, indicador de forca de senha, confirmacao de admin e toast de feedback.
- A tela de criacao passou a usar `Button`, `Input`, `Label` e utilitarios via `cn`, com novo layout em duas colunas e painel lateral informativo sem depender do CSS legado.
- O arquivo legado `web/src/components/Dashboard/Sidebar/CreateUser/CreateUser.css` foi removido.

## Validacao desse ajuste visual e refactor

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`

## Ajuste visual complementar 2026-03-25 (glow do CreateUser)

- O fundo dos cards em `web/src/components/Dashboard/Sidebar/CreateUser/CreateUser.tsx` deixou de usar a faixa linear horizontal no topo.
- O overlay agora usa glows radiais distribuidos pelo card, eliminando o corte reto perceptivel no fundo.

## Validacao desse ajuste visual complementar

- `web`: `npm run build`

## Hotfix 2026-03-25 (alinhamento das colunas no CreateUser)

- As linhas em duas colunas do formulario de `web/src/components/Dashboard/Sidebar/CreateUser/CreateUser.tsx` agora usam `items-start`, evitando que uma coluna seja esticada pela altura da outra.
- Com isso, campos como `Senha` e `Confirmar senha` passam a assentar no mesmo eixo visual, sem o desnivel causado pelo stretch do grid.

## Validacao desse hotfix

- `web`: `npm run build`

## Ajustes pontuais 2026-03-25 (busca, Medalhas e VideoaulaBonus)

- `web/src/pages/AdminUsers.tsx` recebeu mais espacamento no campo de busca, evitando que a lupa volte a encostar no placeholder.
- `web/src/pages/Medalhas.tsx` foi refinada em dois pontos: a area de atribuicao agora alinha melhor os campos de usuario e medalha, e os cards da grade deixaram de esticar a altura da linha inteira.
- `web/src/components/PaginatedSelect.css` foi ajustado para aproximar a altura do seletor do restante dos campos utilitarios do projeto.
- `web/src/pages/VideoaulaBonus.tsx` passou a enquadrar a thumbnail com crop levemente maior e sem fundo preto no card, reduzindo as bordas escuras laterais.

## Validacao desses ajustes pontuais

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`

## Hotfix 2026-03-25 (padding real da busca em AdminUsers)

- `web/src/pages/AdminUsers.tsx` passou a forcar `paddingLeft` inline no campo principal de busca para evitar que o `px-4` da classe base volte a sobrepor o placeholder com a lupa.

## Validacao desse hotfix

- `web`: `npm run build`

## Ajuste visual complementar 2026-03-25 (seletor de medalha com paginacao compacta)

- A selecao de medalha na area de atribuicao em `web/src/pages/Medalhas.tsx` deixou de usar a lista customizada com `Pagination` completo no rodape.
- O bloco agora reutiliza `web/src/components/PaginatedSelect.tsx`, que ja segue o padrao visual compacto com busca interna, cards de resultado e paginação `Ant / pagina / Prox`, como nos seletores do projeto.
- A busca local de medalhas e a paginação manual do bloco foram removidas, simplificando o fluxo para escolha de medalha.
- A medalha selecionada continua aparecendo abaixo do seletor, agora em um resumo compacto com acao de limpar selecao.

## Validacao desse ajuste visual complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`

## Atualizacao complementar 2026-03-25 (AdminUsers em Tailwind + context menu)

- `web/src/pages/AdminUsers.tsx` foi migrada para Tailwind e deixou de depender de `AdminUsers.css`, preservando busca, filtro por tipo, refresh, presence em tempo real, paginacao, edicao e exclusao.
- A listagem saiu do layout antigo de tabela/CSS e passou para cards responsivos com resumo visual de role, contato e status online/offline, mantendo a leitura melhor no desktop e no mobile.
- Cada card de usuario agora abre um `context menu` no clique direito, com acoes para editar, copiar contato, filtrar pela role do usuario e deletar.
- O modal de edicao da pagina tambem foi refeito na nova base utilitaria, mantendo o bloqueio de fechamento durante `salvando`.
- O arquivo legado `web/src/pages/AdminUsers.css` foi removido.

## Validacao dessa atualizacao complementar

- `web`: `npm run lint` (17 warnings antigos de hooks/fast-refresh continuam no projeto; sem erros novos)
- `web`: `npm run build`
- `docker compose up -d --build web`
- `docker compose ps`
- `GET http://localhost:8080` -> `200`
