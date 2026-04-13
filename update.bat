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
git fetch origin main
git reset --hard origin/main
if %errorlevel% neq 0 (
    echo ERROR: Could not sync from GitHub. Check your internet connection.
    pause
    exit /b 1
)

echo [3/4] Installing dependencies...
npm install --silent
if %errorlevel% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo [4/4] Starting app...
echo.
echo App will be available at: http://localhost:8888
echo.
npm run dev
