@echo off
echo ============================================
echo   My Personal Sales Plan — Update
echo ============================================
echo.

echo [1/3] Nieuwste versie ophalen van GitHub...
cd /d C:\taskflow
if not exist ".git" (
    echo ERROR: Map C:\taskflow bestaat niet of is geen git repository.
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

echo [2/3] Dependencies installeren...
npm install --silent
if %errorlevel% neq 0 (
    echo ERROR: npm install mislukt.
    pause
    exit /b 1
)

echo [3/3] Server herstarten...
pm2 restart taskflow
if %errorlevel% neq 0 (
    echo Server nog niet geregistreerd bij PM2, wordt nu gestart...
    pm2 start server.js --name taskflow
    pm2 save
)

echo.
echo ============================================
echo   Klaar! App draait op http://localhost:8888
echo ============================================
echo.
pause
