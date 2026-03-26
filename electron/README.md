# Portal do Aluno Electron

Essa pasta e um wrapper Electron em TypeScript para a app que ja existe em `../web`.

## Como usar

1. Rode `npm install` dentro desta pasta.
2. Use `npm run dev` para subir o Vite da pasta `../web`, compilar o wrapper TS e abrir o Electron.
3. Use `npm run build` para gerar `renderer-dist/` a partir de `../web/dist` e compilar `dist-electron/`.
4. Use `npm run dist` para gerar o instalador Windows em `release/`.
5. Use `npm run publish:release` para gerar o instalador e publicar `latest.yml`, `.exe` e `.blockmap` no R2/CDN.

## Backend

- O renderer continua sendo a app de `../web`.
- No build desktop, o Electron sobe um servidor local para servir os arquivos de `renderer-dist/`.
- Esse servidor tambem faz proxy de `/api` e `/ws` para o backend configurado em `.env`.
- O fallback padrao aponta para `https://painel-portaldoaluno.santos-tech.com`.

## Estrutura

- `../web` continua sendo a fonte do frontend.
- `scripts/sync-renderer.ts` copia apenas o build pronto de `../web/dist` para `renderer-dist/`.
- `scripts/publish-release.ts` faz o build do instalador NSIS e envia os artefatos de update para o bucket R2.
- `electron/main.ts` sobe a janela Electron e o servidor local.
- `electron/preload.ts` mantem a ponte segura com o renderer.

## Atualizacoes

- O app verifica updates ao abrir e tambem expõe a acao manual dentro das configuracoes.
- O feed esperado fica em `https://cdn.portaldoaluno.santos-tech.com/desktop/painel/win/latest.yml`.
- Para publicar uma nova versao, atualize `version` em `electron/package.json` e rode `npm run publish:release`.
- O script aceita tanto as novas vars `R2_*` quanto as credenciais `CLOUDFLARE_*` ja usadas no `.env` raiz.
