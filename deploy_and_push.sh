#!/usr/bin/env bash

set -u

# ================== CONFIG ==================
BRANCH="master"
DEPLOY_CMD=(docker compose up -d --build)

# Se você usa o binário antigo:
# DEPLOY_CMD=(docker-compose up -d --build)
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
  echo " - Logs: docker compose logs api"
  echo " - Reiniciar: docker compose down && docker compose up -d --build"
  echo
  exit 1
}

ask_yes_no() {
  local prompt="$1"
  local resp
  read -r -p "$prompt" resp
  [[ "$resp" =~ ^[sS]$ ]]
}

print_header

# ----- Verifica Git -----
if ! command -v git >/dev/null 2>&1; then
  echo "[ERRO] Git não encontrado no PATH."
  exit 1
fi

# ----- Verifica Docker -----
if ! docker info >/dev/null 2>&1; then
  echo "[ERRO] Docker não está rodando. Inicie o Docker/daemon."
  exit 1
fi

echo "Branch alvo: $BRANCH"
if ! ask_yes_no "Deseja rodar o deploy na branch $BRANCH? (s/n): "; then
  echo "Deploy cancelado pelo usuário."
  exit 0
fi

# ----- Repo git? -----
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[ERRO] Este diretório não parece ser um repositório Git."
  exit 1
fi

echo
echo "=== GIT: checkout + pull ==="
git fetch || fail
git checkout "$BRANCH" || fail
git pull --rebase --autostash || fail

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
echo "Logs: docker compose logs api"
echo

if ! ask_yes_no "Os containers estão rodando corretamente? (s/n): "; then
  echo "Ok, abortando antes de qualquer push."
  exit 0
fi

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