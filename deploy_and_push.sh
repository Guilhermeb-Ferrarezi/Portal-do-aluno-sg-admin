#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ================== CONFIG ==================
DEFAULT_BRANCH="$(git branch --show-current 2>/dev/null || echo master)"
BRANCH="${BRANCH:-$DEFAULT_BRANCH}"
ENV_FILE=".env"
DEPLOY_CMD=()
LOGS_CMD="docker compose logs api"
RESTART_CMD="docker compose down && docker compose up -d --build"
PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"
# ===========================================

print_header() {
  echo
  echo "====================================="
  echo "  DEPLOY - Portal do Aluno"
  echo "====================================="
  echo
}

fail() {
  echo
  echo "====================================="
  echo "FALHOU. Abortando."
  echo "====================================="
  echo "Dicas:"
  echo " - Logs: $LOGS_CMD"
  echo " - Reiniciar: $RESTART_CMD"
  echo
  exit 1
}

ask_yes_no() {
  local prompt="$1"
  local resp
  read -r -p "$prompt" resp
  [[ "$resp" =~ ^[sS]$ ]]
}

setup_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    DEPLOY_CMD=(docker compose up -d --build)
    LOGS_CMD="docker compose logs api"
    RESTART_CMD="docker compose down && docker compose up -d --build"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    DEPLOY_CMD=(docker-compose up -d --build)
    LOGS_CMD="docker-compose logs api"
    RESTART_CMD="docker-compose down && docker-compose up -d --build"
    return
  fi

  echo "[ERRO] Docker Compose nao encontrado."
  exit 1
}

ensure_local_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  cat > "$ENV_FILE" <<'EOF'
# Arquivo local criado automaticamente pelo deploy_and_push.sh
# Ajuste os valores abaixo se precisar apontar para outro ambiente.
JWT_SECRET=portal-do-aluno-local-dev
PRESENCE_PROXY_SECRET=portal-do-aluno-local-proxy
POSTGRES_DB=portal_santos_tech
POSTGRES_USER=iasg
POSTGRES_PASSWORD=iasg123
DB_NAME=portal_santos_tech
DB_USER=iasg
DB_PASSWORD=iasg123
DB_SSL=disable
IA_SG_DB_PORT=15432
DOCKER_DB_PROXY_PORT=15432
IA_SG_API_PORT=3001
IA_SG_WEB_PORT=8080
IA_SG_ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
CODEX_DANGEROUSLY_BYPASS_APPROVALS_AND_SANDBOX=1
VITE_API_URL=/api
VITE_POINTS_API_URL=https://portal.santos-tech.com/api
EOF

  echo "[INFO] .env nao existia e foi criado com defaults locais."
}

ensure_docker_running() {
  local docker_info_output=""

  if docker_info_output="$(docker info 2>&1)"; then
    return
  fi

  echo "[ERRO] Docker nao esta acessivel."
  if [[ "$docker_info_output" == *"permission denied"* ]] || [[ "$docker_info_output" == *"/var/run/docker.sock"* ]]; then
    echo "Seu usuario nao tem permissao para acessar o daemon Docker."
    echo "No Linux, adicione o usuario ao grupo docker e reabra a sessao:"
    echo "  sudo usermod -aG docker \$USER"
    echo "Depois, faca logout/login (ou rode 'newgrp docker') e tente novamente."
    echo
    echo "Se precisar testar sem relogar, rode o script com sudo."
    exit 1
  fi

  if command -v systemctl >/dev/null 2>&1 && [[ "$(uname -s)" == "Linux" ]]; then
    echo "No Linux, tente iniciar com:"
    echo "  sudo systemctl enable --now docker"
  else
    echo "Inicie o Docker Desktop/daemon e tente novamente."
  fi
  exit 1
}

has_local_changes() {
  ! git diff --quiet || ! git diff --cached --quiet
}

run_playwright_smoke() {
  if ! command -v bun >/dev/null 2>&1; then
    echo "[ERRO] bun nao encontrado no PATH."
    exit 1
  fi

  echo
  echo "=== PLAYWRIGHT E2E ==="
  echo "Base URL: $PLAYWRIGHT_BASE_URL"

  (
    cd web || exit 1
    PLAYWRIGHT_BASE_URL="$PLAYWRIGHT_BASE_URL" \
    PLAYWRIGHT_SKIP_WEBSERVER=1 \
    bun run test:e2e:smoke
  ) || {
    echo
    echo "[ERRO] Os testes Playwright falharam. Abortando antes de commit/push."
    echo "Dica: se faltar browser, rode 'cd web && bun run playwright:install'."
    exit 1
  }
}

print_header

# ----- Verifica Git -----
if ! command -v git >/dev/null 2>&1; then
  echo "[ERRO] Git não encontrado no PATH."
  exit 1
fi

# ----- Repo git? -----
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[ERRO] Este diretório não parece ser um repositório Git."
  exit 1
fi

setup_compose_cmd
ensure_local_env_file
ensure_docker_running

echo "Branch alvo: $BRANCH"
if ! ask_yes_no "Deseja rodar o deploy na branch $BRANCH? (s/n): "; then
  echo "Deploy cancelado pelo usuário."
  exit 0
fi

if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo
  echo "=== GIT: checkout ==="
  git checkout "$BRANCH" || fail
fi

if has_local_changes; then
  echo
  echo "[AVISO] Existem alteracoes locais nao commitadas:"
  git status --short
fi

echo
if ask_yes_no "Deseja sincronizar com o remoto antes do deploy? (s/n): "; then
  echo "=== GIT: fetch + pull ==="
  git fetch || fail
  git pull --rebase --autostash || fail
else
  echo "Seguindo com o codigo local atual."
fi

echo
echo "=== DEPLOY COM DOCKER ==="
echo "Comando: ${DEPLOY_CMD[*]}"
"${DEPLOY_CMD[@]}" || fail

echo
echo "=== STATUS (docker ps) ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

echo
echo "====================================="
echo "Teste para ver se posso fazer deploy"
echo "====================================="
echo
echo "Acesse em:"
echo "Frontend: http://localhost:8080"
echo "API: http://localhost:3001"
echo "Logs: $LOGS_CMD"
echo

if ! ask_yes_no "Os containers estão rodando corretamente? (s/n): "; then
  echo "Ok, abortando antes de qualquer push."
  exit 0
fi

run_playwright_smoke

echo
if ! ask_yes_no "Deseja fazer commit e push agora? (s/n): "; then
  echo "Beleza. Deploy feito. Sem push."
  exit 0
fi

# ----- Se não tem nada pra commitar, ainda pode fazer push -----
if git diff --quiet && git diff --cached --quiet; then
  echo "Não há alterações para commitar."
else
  echo
  echo "(Dica: pode digitar qualquer coisa, inclusive &, |, (, ), ! sem quebrar)"
  read -r -p "Digite a mensagem do commit: " msg

  if [[ -z "$msg" ]]; then
    echo "[ERRO] Mensagem vazia. Cancelando."
    exit 1
  fi

  echo
  echo "=== GIT: add ==="
  git add . || fail

  # ----- Commit blindado: usa arquivo temporário -----
  MSGFILE="$(mktemp)"
  printf '%s\n' "$msg" > "$MSGFILE"

  echo
  echo "=== GIT: commit ==="
  if ! git commit -F "$MSGFILE"; then
    rm -f "$MSGFILE"
    fail
  fi

  rm -f "$MSGFILE"
fi

echo
echo "=== GIT: push ==="
git push || fail

echo
echo "====================================="
echo "OK: Deploy + Push concluído"
echo "====================================="
exit 0
