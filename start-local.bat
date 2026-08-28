@echo off
title ஜிவி மொபைல்ஸ் - Jivi Mobiles - Local Server
echo.
echo ========================================
echo   JIVI MOBILES - Local Server
echo ========================================
echo.
echo Starting server on http://localhost:3001
echo.
echo After server starts, open Chrome and go to:
echo   http://localhost:3001/owner.html
echo.
echo DO NOT close this window while using the app.
echo.

cd /d "%~dp0server"
node server.js

pause
