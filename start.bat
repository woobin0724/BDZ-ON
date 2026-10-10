@echo off
chcp 65001 >nul
title ONITDA demo server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ONITDA] Node.js 20 or later is required. Install it from https://nodejs.org
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" goto setup
if not exist "frontend\node_modules" goto setup
if not exist "node_modules" goto setup
goto run

:setup
echo [ONITDA] First run: installing Python and Node packages...
call npm run setup
if errorlevel 1 (
  echo [ONITDA] Setup failed. See the messages above.
  pause
  exit /b 1
)

:run
echo [ONITDA] Building the screens and starting the server on http://localhost:8000
echo [ONITDA] Close this window to stop the demo.
start "" /b node scripts\open-when-ready.mjs http://localhost:8000/demo
call npm run demo
pause
