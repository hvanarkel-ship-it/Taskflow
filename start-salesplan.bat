@echo off
echo Starting PostgreSQL...
net start postgresql-x64-18 2>nul
if %errorlevel% neq 0 (
    echo PostgreSQL already running or insufficient rights - continuing...
)
timeout /t 3 /nobreak >nul
echo Starting app...
cd /d C:\taskflow
start "" cmd /k "npm run dev"
