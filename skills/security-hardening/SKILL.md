# Security Hardening — Portal do Aluno

Skill de correção das vulnerabilidades encontradas na auditoria de 2026-04-17 contra a API (`api/`) e deploy em `https://admin-portal.santos-tech.com`.

## Quando usar

Use esta skill sempre que for:
- Mexer em `auth.ts`, `middlewares/auth.ts`, `users.ts`, `presence.ts`, `materiais.route.ts`, `uploadR2.ts` ou `server.ts`.
- Adicionar rotas novas que recebam URL do usuário, upload de arquivo, token JWT, ou verificação de senha.
- Preparar release para produção — passar pelo checklist antes de deploy.

## Fonte de verdade

Board: `skills/security-hardening/references/findings.md` — lista priorizada das vulnerabilidades, status e commits de correção. Atualize o checkbox e a linha `Progresso:` no mesmo commit que fecha cada item.

## Princípios

1. **Sem fallback inseguro**: remova branches de compatibilidade que aceitem hash fraco, URL não validada ou token sem claims obrigatórias. Se precisar de migração, faça-a em janela única, com script, não com fallback permanente em produção.
2. **Resposta neutra em auth**: login, reset de senha e SSO devem retornar a mesma mensagem/status para "conta inexistente", "senha errada" e "role proibida". Oráculos = vazamento.
3. **Validar conteúdo, não metadado**: nunca confie em `mimetype` do cliente. Para qualquer upload de imagem, rode `file-type`/`sharp` e valide magic bytes antes de persistir.
4. **URL só com `http(s):`**: qualquer campo que aceite URL do usuário (profile, material, redirect) precisa de `parsed.protocol === "http:" || "https:"` além do `new URL()`.
5. **JWT sempre com algoritmo explícito**: `jwt.verify(token, secret, { algorithms: ["HS256"] })`.
6. **Rate-limit por usuário**, não só por IP, em `/auth/login` e `/auth/password-reset/request`.
7. **Métricas e docs são internos**: `/metrics`, `/docs`, `/docs/openapi.json` protegidos por admin + (idealmente) allowlist de IP.
8. **Deduplicar `verifyPassword`**: mover para `api/src/utils/verifyPassword.ts` e importar nos dois lugares. Qualquer mudança na política de senha tem que pegar os dois call sites.

## Fluxo de correção

1. Ler `references/findings.md` e pegar o item mais alto não resolvido.
2. Criar branch `sec/<slug-do-item>`.
3. Implementar correção + teste (unit ou Playwright cobrindo o vetor).
4. Rodar `cd api && bun run build` e, se tocar UI, `cd web && bun run lint && bun run build && bun run test:e2e`.
5. Marcar o item como ✅ em `findings.md` com hash do commit.
6. PR com título `sec: <item>` e descrição citando o finding.

## Checklist de release (antes de `deploy_and_push`)

- [ ] `verifyPassword` não tem branch SHA-256 puro.
- [ ] `jwt.verify` usa `{ algorithms: ["HS256"] }`.
- [ ] `/api/metrics` e `/api/docs` exigem auth admin.
- [ ] Qualquer campo URL do usuário rejeita `javascript:`/`data:`.
- [ ] Upload de imagem valida magic bytes + whitelist de extensão.
- [ ] Rotas `/auth/*` retornam mensagem neutra para conta inexistente.
- [ ] Login não revela senha válida para role bloqueada (aluno no admin).
- [ ] `PRESENCE_PROXY_SECRET` e `PASSWORD_RESET_TOKEN_SECRET` obrigatórios em produção (`zod` com `.min(32)` e sem `.optional()` quando `NODE_ENV=production`).
- [ ] `ORDER BY id ASC` nos selects que usam `LIMIT 1` em login por nome (ou desabilitar login por nome).

## Regras rígidas

- Nunca reintroduzir hash legado em `verifyPassword` sem plano de rehash no login.
- Nunca logar `refreshToken`, `token`, `password_hash` nem headers `authorization` — observability middleware deve continuar redatando.
- Nunca aceitar `role` vindo do body do usuário; role sempre do JWT validado.
- Nunca confiar em `X-Forwarded-For` sem `trust proxy` configurado com o número exato de hops (hoje = 1, Cloudflare). Se sair da Cloudflare, revisar.

## Referências cruzadas

- `api/src/routes/auth.ts` — login, refresh, reset, SSO.
- `api/src/middlewares/auth.ts` — parse de JWT e fallback ao DB (remover).
- `api/src/routes/users.ts` — update profile, upload imagem, `verifyPassword` duplicada.
- `api/src/routes/materiais.route.ts` — upload e link.
- `api/src/utils/uploadR2.ts` — ContentType do cliente vira ContentType no R2.
- `api/src/server.ts` — CORS, rate limit, `/metrics`, `/docs`, CSP.
