@echo off
timeout /t 5 /nobreak >nul
echo Starting app...
cd /d C:\taskflow
node server.js
