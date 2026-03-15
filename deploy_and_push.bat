@echo off
setlocal EnableExtensions DisableDelayedExpansion


REM ================== CONFIG ==================
set "BRANCH=master"
set "DEPLOY_CMD=docker compose up -d --build"

REM Se voc?? usa o bin??rio antigo:

REM set "DEPLOY_CMD=docker-compose up -d --build"

REM ============================================

color 0A
echo.
echo =====================================
echo   DEPLOY - Portal do Aluno
echo =====================================
echo.


REM ----- Verifica Git -----
git --version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  exit /b 1
)


REM ----- Verifica Docker -----
docker info >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Docker nao esta rodando. Inicie o Docker Desktop/daemon.
  exit /b 1
)

echo Branch alvo: %BRANCH%
set "resp="
set /p "resp=Deseja rodar o deploy na branch %BRANCH%? (s/n): "
if /i not "%resp%"=="s" (
  echo Deploy cancelado pelo usuario.
  exit /b 0
)


REM ----- Repo git? -----
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Este diretorio nao parece ser um repositorio Git.
  exit /b 1
)

echo.
echo === GIT: checkout + pull ===
git fetch
if errorlevel 1 goto fail

git checkout %BRANCH%
if errorlevel 1 goto fail

git pull --rebase --autostash
if errorlevel 1 goto fail

echo.
echo === DEPLOY COM DOCKER ===
echo Comando: %DEPLOY_CMD%
%DEPLOY_CMD%
if errorlevel 1 goto fail


@REM echo.

@REM echo === Aguardando containers subirem... ===

@REM timeout /t 5 /nobreak >nul

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
echo Logs: docker compose logs api
echo.

set "ok="
set /p "ok=Os containers estao rodando corretamente? (s/n): "
if /i not "%ok%"=="s" (
  echo Ok, abortando antes de qualquer push.
  exit /b 0
)

echo.
set "doPush="
set /p "doPush=Deseja fazer commit e push agora? (s/n): "
if /i not "%doPush%"=="s" (
  echo Beleza. Deploy feito. Sem push.
  exit /b 0
)


REM ----- Se nao tem nada pra commitar, ainda pode fazer push -----
git diff --quiet
set "hasWork=%errorlevel%"
git diff --cached --quiet
set "hasStage=%errorlevel%"

if "%hasWork%"=="0" if "%hasStage%"=="0" (
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


REM ----- Commit blindado: usa arquivo temporario -----
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

:fail
echo.
echo =====================================
echo FALHOU. Abortando.
echo =====================================
echo Dicas:
echo  - Logs: docker compose logs api
echo  - Reiniciar: docker compose down ^&^& docker compose up -d --build
echo.
exit /b 1