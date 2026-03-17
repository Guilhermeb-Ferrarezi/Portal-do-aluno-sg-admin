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
- Nao rodei `deploy_and_push.bat` diretamente porque ele faz `git checkout master` e `git pull --rebase --autostash`, o que altera o estado do repositorio.
