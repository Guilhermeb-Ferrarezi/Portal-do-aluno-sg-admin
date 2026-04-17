# Findings — Auditoria 2026-04-17

**Escopo:** `api/` + produção `https://admin-portal.santos-tech.com`.
**Credencial usada:** admin autenticado (role=3, user id 4).
**Progresso:** 0/18 resolvidos.

Legenda: 🔴 crítica · 🟠 alta · 🟡 média · 🟢 baixa. Status: `[ ]` pendente · `[x] <sha>` resolvido.

---

## 🔴 Críticas

- [ ] **F-01 · SHA-256 sem salt aceito em `verifyPassword`**
  Arquivo: `api/src/routes/auth.ts:155-177` e `api/src/routes/users.ts:79-101` (código duplicado).
  Fix: remover branches SHA (base64 e hex), deduplicar em `utils/verifyPassword.ts`, e no login com hash legado fazer rehash para bcrypt in-line antes de responder.

- [ ] **F-02 · Login por `name` + `LIMIT 1` sem ORDER BY**
  Arquivo: `api/src/routes/auth.ts:407-414`, `:540-547`.
  Fix: ou remover login por nome, ou `ORDER BY id ASC` + UNIQUE INDEX em `LOWER(TRIM(name))`.

- [ ] **F-03 · Enumeração de conta no `/auth/password-reset/request` (regressão iminente)**
  Arquivo: `api/src/routes/auth.ts:550-554` (retorna 404 "Nao encontramos uma conta...").
  Produção hoje tem msg neutra — próximo deploy regride.
  Fix: sempre 200 com `"Se encontramos uma conta correspondente, enviamos..."`. Mesma mensagem para role bloqueada.

- [ ] **F-04 · Oracle de senha válida para aluno no portal admin**
  Arquivo: `api/src/routes/auth.ts:454-489` — verifica senha antes do check de role.
  Fix: reordenar — buscar role primeiro e retornar 401 genérico se role não permitida, ou verificar senha com `bcrypt.compare` dummy para manter tempo constante.

## 🟠 Altas

- [ ] **F-05 · `jwt.verify` sem `algorithms` whitelist**
  Arquivo: `api/src/middlewares/auth.ts:130`.
  Fix: `jwt.verify(token, secret, { algorithms: ["HS256"] })`.

- [ ] **F-06 · Fallback de claims via DB aceita token incompleto**
  Arquivo: `api/src/middlewares/auth.ts:137-153`.
  Fix: exigir `sub` + `role` + `usuario` no próprio token; se faltar, 401.

- [ ] **F-07 · Upload de imagem só valida `mimetype` do cliente**
  Arquivo: `api/src/routes/users.ts:62-69` + `api/src/utils/uploadR2.ts:86-93`.
  Fix: `file-type` + `sharp.metadata()` para confirmar imagem real; whitelist `png/jpg/webp`; rejeitar `svg`; gerar extensão no servidor; forçar `ContentType` do servidor.

- [ ] **F-08 · Material com `tipo=link` aceita `javascript:` / `data:` URL (Stored XSS)**
  Arquivo: `api/src/routes/materiais.route.ts:386-391`, `:484-491`.
  Fix: `const u = new URL(data.url); if (u.protocol !== "http:" && u.protocol !== "https:") return 400`.

- [ ] **F-09 · Materiais: upload sem whitelist de tipo**
  Arquivo: `api/src/routes/materiais.route.ts:10-15`.
  Fix: fileFilter por mimetype whitelisted + validação de magic bytes para imagens.

- [ ] **F-10 · `/api/metrics` público**
  Arquivo: `api/src/server.ts:394-401`.
  **Confirmado em prod**: `curl https://admin-portal.santos-tech.com/api/metrics` → 200.
  Fix: `authGuard(env.JWT_SECRET), requireRole(["admin"])` antes dos handlers, ou bind em porta interna.

- [ ] **F-11 · Rate-limit de login só por IP**
  Arquivo: `api/src/server.ts:345-350`, `:405-419`.
  Fix: limiter separado **só em `/auth/login` e `/auth/password-reset/request`**, com `keyGenerator` que combine IP + `req.body.usuario`.

## 🟡 Médias

- [x] **F-12 · `PUT /users/me` aceita `profilePictureUrl` como string livre** — **EXPLORADO COM SUCESSO**
  Arquivo: `api/src/routes/users.ts:276-291`.
  PoC: `PUT /api/users/me` com `{"profilePictureUrl":"javascript:alert(1)"}` → salvo no DB.
  Fix: `z.string().url()` + validar protocolo `http(s):`; idealmente exigir URL do próprio CDN R2.

- [ ] **F-13 · Fallback de `passwordResetTokenSecret` deriva do JWT secret**
  Arquivo: `api/src/routes/auth.ts:227`.
  Fix: exigir `PASSWORD_RESET_TOKEN_SECRET` em produção; zod `.min(32)` sem `.optional()` quando `NODE_ENV=production`.

- [ ] **F-14 · Presence: `PRESENCE_PROXY_SECRET` bypass total de auth**
  Arquivo: `api/src/routes/presence.ts:41-80`.
  Fix: exigir `.min(32)`, comparação com `crypto.timingSafeEqual`, allowlist de IP (proxy interno).

- [ ] **F-15 · CSP de `/docs` libera `https://unpkg.com` inteiro**
  Arquivo: `api/src/server.ts:291-309`.
  Fix: travar em URL exata de Swagger UI + SRI.

- [ ] **F-16 · `/presence/heartbeat` e `/presence/socket-ticket` isentos do rate limiter**
  Arquivo: `api/src/server.ts:256-271`.
  Fix: limiter dedicado com janela curta mas limite alto (300/min por user).

## 🟢 Baixas

- [ ] **F-17 · Mensagem 413 genérica "arquivo de ícone"**
  Arquivo: `api/src/server.ts:496-499`.
  Fix: mensagem neutra "Payload muito grande".

- [ ] **F-18 · Erros do `pg` podem vazar pelo handler genérico**
  Arquivo: `api/src/server.ts:479-508`.
  Fix: só propagar `e.message` se `e.status < 500`; para 500, sempre "Erro interno".

---

## Evidências coletadas

```
# /api/metrics público
$ curl -s -o /dev/null -w "%{http_code}" https://admin-portal.santos-tech.com/api/metrics
200

# Stored XSS em profile
$ curl -X PUT -H "Authorization: Bearer <admin>" \
    -H "Content-Type: application/json" \
    -d '{"profilePictureUrl":"javascript:alert(1)"}' \
    https://admin-portal.santos-tech.com/api/users/me
{"message":"Perfil atualizado com sucesso!","user":{"profilePictureUrl":"javascript:alert(1)",...}}

# Rate limit /auth funcionando
ratelimit: limit=10, remaining=9, reset=60
```

## Contexto do ataque

- JWT da sessão do pentest (id 4, role 3) revogado após testes — revogar via `/auth/logout` com refresh token.
- Nenhuma escrita destrutiva feita além de atualização do próprio perfil do testador.
- `profilePictureUrl` do usuário 4 precisa ser revertido manualmente (`UPDATE "user" SET profile_picture_url = NULL WHERE id = 4`) — **TODO do dono do sistema**.
