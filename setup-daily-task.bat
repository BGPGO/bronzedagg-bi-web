@echo off
REM Configura tarefa agendada no Windows Task Scheduler
REM Executa o scraper Trinks diariamente às 06:00

set TASK_NAME=BronzedaGG-Trinks-Daily
set SCRIPT_DIR=%~dp0
set NODE_PATH=node

echo === Configurando tarefa diaria: %TASK_NAME% ===
echo Diretorio: %SCRIPT_DIR%
echo.

REM Deletar tarefa existente (se houver)
schtasks /delete /tn "%TASK_NAME%" /f 2>nul

REM Criar tarefa agendada
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "cmd /c cd /d \"%SCRIPT_DIR%\" && node scrape-trinks.cjs --daily --headless && node fetch-data.cjs && node bgp-bi.cjs build && git add -A -f && git commit -m \"chore: daily trinks update %%date%%\" --author=\"BGP Bot <bot@bertuzzipatrimonial.com.br>\" && git push origin main" ^
  /sc daily ^
  /st 06:00 ^
  /ru "%USERNAME%" ^
  /rl HIGHEST

if %ERRORLEVEL% == 0 (
  echo.
  echo === Tarefa criada com sucesso! ===
  echo Nome: %TASK_NAME%
  echo Horario: 06:00 diariamente
  echo.
  echo Para verificar: schtasks /query /tn "%TASK_NAME%" /v
  echo Para rodar agora: schtasks /run /tn "%TASK_NAME%"
  echo Para remover: schtasks /delete /tn "%TASK_NAME%" /f
) else (
  echo.
  echo ERRO ao criar tarefa. Tente rodar como Administrador.
)

pause
