@echo off
echo ============================================
echo   My Personal Sales Plan — Update ^& Start
echo ============================================
echo.

echo [1/4] Stopping existing server on port 8888...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :8888 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [2/4] Syncing latest version from GitHub...
cd /d C:\taskflow
if not exist ".git" (
    echo ERROR: Map C:\taskflow bestaat niet of is geen git repository.
    echo Controleer of de app op C:\taskflow staat.
    pause
    exit /b 1
)
git fetch origin main
git reset --hard origin/main
if %errorlevel% neq 0 (
    echo ERROR: Kon niet synchroniseren met GitHub. Controleer internetverbinding.
    pause
    exit /b 1
)

echo [3/4] Installing dependencies...
npm install --silent
if %errorlevel% neq 0 (
    echo ERROR: npm install mislukt.
    pause
    exit /b 1
)

echo [4/4] Starting app...
echo.
echo ============================================
echo   App beschikbaar op: http://localhost:8888
echo   Sluit dit venster NIET — de app stopt dan
echo ============================================
echo.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Server afgesloten met foutcode %errorlevel%
    pause
)
