# Playwright E2E

Smoke tests live here and exercise the real portal shell.

## Commands

```bash
npm run playwright:install
npm run test:e2e
```

## Local setup

Keep the API available before running the suite. By default the Playwright config starts only the Vite frontend at `http://127.0.0.1:4173` and relies on the existing Vite proxy to reach the API on `http://localhost:3000`.

If you already have the frontend running, use:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

## Authenticated smoke

The authenticated specs are enabled only when both variables below are present:

```bash
PLAYWRIGHT_USERNAME=seu-usuario
PLAYWRIGHT_PASSWORD=sua-senha
```

Without them, the anonymous smoke tests still run.
