# ---------- prod-deps ----------
FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# ---------- build ----------
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV CODEX_HOME=/root/.codex
ENV CODEX_DANGEROUSLY_BYPASS_APPROVALS_AND_SANDBOX=1

RUN apk add --no-cache ca-certificates git \
  && npm install -g @openai/codex

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
