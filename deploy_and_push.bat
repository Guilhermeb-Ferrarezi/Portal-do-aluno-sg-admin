@echo off
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"

REM ================== CONFIG ==================
set "DEFAULT_BRANCH=master"
for /f "delims=" %%i in ('git branch --show-current 2^>nul') do set "DEFAULT_BRANCH=%%i"
if not defined DEFAULT_BRANCH set "DEFAULT_BRANCH=master"
set "BRANCH=%DEFAULT_BRANCH%"
set "ENV_FILE=.env"
set "DEPLOY_CMD=docker compose up -d --build"
set "LOGS_CMD=docker compose logs api"
set "RESTART_CMD=docker compose down ^&^& docker compose up -d --build"
set "PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080"
REM ============================================

color 0A
echo.
echo =====================================
echo   DEPLOY - Portal do Aluno
echo =====================================
echo.

call :ensure_repo || exit /b 1
call :setup_compose || exit /b 1
call :ensure_local_env_file || exit /b 1
call :ensure_docker_running || exit /b 1

echo Branch alvo: %BRANCH%
call :ask_yes_no "Deseja rodar o deploy na branch %BRANCH%? (s/n): "
if errorlevel 1 (
  echo Deploy cancelado pelo usuario.
  exit /b 0
)

for /f "delims=" %%i in ('git branch --show-current') do set "CURRENT_BRANCH=%%i"
if /i not "%CURRENT_BRANCH%"=="%BRANCH%" (
  echo.
  echo === GIT: checkout ===
  git checkout %BRANCH%
  if errorlevel 1 goto fail
)

call :has_local_changes
if not errorlevel 1 (
  echo.
  echo [AVISO] Existem alteracoes locais nao commitadas:
  git status --short
)

echo.
call :ask_yes_no "Deseja sincronizar com o remoto antes do deploy? (s/n): "
if errorlevel 1 (
  echo Seguindo com o codigo local atual.
) else (
  echo === GIT: fetch + pull ===
  git fetch
  if errorlevel 1 goto fail
  git pull --rebase --autostash
  if errorlevel 1 goto fail
)

echo.
echo === DEPLOY COM DOCKER ===
echo Comando: %DEPLOY_CMD%
%DEPLOY_CMD%
if errorlevel 1 goto fail

echo.
echo === STATUS (docker ps) ===
docker ps --format "table {{.Names}}\t{{.Status}}"

echo.
echo =====================================
echo Teste para ver se posso fazer deploy
echo =====================================
echo.
echo Acesse em:
echo Frontend: http://localhost:8080
echo API: http://localhost:3001
echo Logs: %LOGS_CMD%
echo.

call :ask_yes_no "Os containers estao rodando corretamente? (s/n): "
if errorlevel 1 (
  echo Ok, abortando antes de qualquer push.
  exit /b 0
)

echo.
echo === PLAYWRIGHT E2E ===
echo Base URL: %PLAYWRIGHT_BASE_URL%
pushd web
set "PLAYWRIGHT_BASE_URL=%PLAYWRIGHT_BASE_URL%"
set "PLAYWRIGHT_SKIP_WEBSERVER=1"
bun run test:e2e:smoke
set "pwExit=%errorlevel%"
set "PLAYWRIGHT_BASE_URL="
set "PLAYWRIGHT_SKIP_WEBSERVER="
popd
if not "%pwExit%"=="0" (
  echo [ERRO] Os testes Playwright falharam. Abortando antes de commit/push.
  echo Dica: se faltar browser, rode "cd web && bun run playwright:install".
  exit /b 1
)

echo.
call :ask_yes_no "Deseja fazer commit e push agora? (s/n): "
if errorlevel 1 (
  echo Beleza. Deploy feito. Sem push.
  exit /b 0
)

call :has_local_changes
if errorlevel 1 (
  echo Nao ha alteracoes para commitar.
  goto onlypush
)

echo.
echo (Dica: pode digitar qualquer coisa, inclusive ^& ^| ^( ^) ^! sem quebrar)
set "msg="
set /p "msg=Digite a mensagem do commit: "
if "%msg%"=="" (
  echo [ERRO] Mensagem vazia. Cancelando.
  exit /b 1
)

echo.
echo === GIT: add ===
git add .
if errorlevel 1 goto fail

set "MSGFILE=%TEMP%\gitmsg_%RANDOM%%RANDOM%.txt"
> "%MSGFILE%" (
  echo %msg%
)

echo.
echo === GIT: commit ===
git commit -F "%MSGFILE%"
set "c=%errorlevel%"
del /f /q "%MSGFILE%" >nul 2>&1
if not "%c%"=="0" goto fail

:onlypush
echo.
echo === GIT: push ===
git push
if errorlevel 1 goto fail

echo.
echo =====================================
echo OK: Deploy + Push concluido
echo =====================================
exit /b 0

:ensure_repo
echo [1/4] Verificando Git...
git --version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  exit /b 1
)

echo [2/4] Verificando bun...
bun --version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] bun nao encontrado no PATH.
  exit /b 1
)

echo [3/4] Verificando repositorio Git...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Este diretorio nao parece ser um repositorio Git.
  exit /b 1
)
exit /b 0

:setup_compose
docker compose version >nul 2>&1
if not errorlevel 1 (
  set "DEPLOY_CMD=docker compose up -d --build"
  set "LOGS_CMD=docker compose logs api"
  set "RESTART_CMD=docker compose down ^&^& docker compose up -d --build"
  exit /b 0
)

docker-compose --version >nul 2>&1
if not errorlevel 1 (
  set "DEPLOY_CMD=docker-compose up -d --build"
  set "LOGS_CMD=docker-compose logs api"
  set "RESTART_CMD=docker-compose down ^&^& docker-compose up -d --build"
  exit /b 0
)

echo [ERRO] Docker Compose nao encontrado.
exit /b 1

:ensure_local_env_file
if exist "%ENV_FILE%" exit /b 0

(
  echo # Arquivo local criado automaticamente pelo deploy_and_push.bat
  echo # Ajuste os valores abaixo se precisar apontar para outro ambiente.
  echo JWT_SECRET=portal-do-aluno-local-dev
  echo PRESENCE_PROXY_SECRET=portal-do-aluno-local-proxy-secret-2026
  echo PASSWORD_RESET_TOKEN_SECRET=portal-do-aluno-local-password-reset-secret-2026
  echo POSTGRES_DB=portal_santos_tech
  echo POSTGRES_USER=iasg
  echo POSTGRES_PASSWORD=iasg123
  echo DB_NAME=portal_santos_tech
  echo DB_USER=iasg
  echo DB_PASSWORD=iasg123
  echo DB_SSL=disable
  echo IA_SG_DB_PORT=15432
  echo DOCKER_DB_PROXY_PORT=15432
  echo IA_SG_API_PORT=3001
  echo IA_SG_WEB_PORT=8080
  echo IA_SG_ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
  echo VITE_API_URL=/api
  echo VITE_POINTS_API_URL=https://portal.santos-tech.com/api
) > "%ENV_FILE%"

echo [INFO] .env nao existia e foi criado com defaults locais.
exit /b 0

:ensure_docker_running
echo [4/4] Verificando Docker...
docker info >nul 2>&1
if not errorlevel 1 exit /b 0

echo [ERRO] Docker nao esta rodando. Inicie o Docker Desktop/daemon.
exit /b 1

:ask_yes_no
set "resp="
set /p "resp=%~1"
if /i "%resp%"=="s" exit /b 0
exit /b 1

:has_local_changes
git diff --quiet
if errorlevel 1 exit /b 0
git diff --cached --quiet
if errorlevel 1 exit /b 0
exit /b 1

:fail
echo.
echo =====================================
echo FALHOU. Abortando.
echo =====================================
echo Dicas:
echo  - Logs: %LOGS_CMD%
echo  - Reiniciar: %RESTART_CMD%
echo.
exit /b 1
