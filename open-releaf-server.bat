@echo off
:: ReLeaf — serve the built site on http://localhost:4173
:: Requires Node.js installed (node --version to check)

echo ============================================
echo   ReLeaf Local Server
echo   Opening: http://localhost:4173
echo   Press Ctrl+C to stop
echo ============================================

timeout /t 2 /nobreak >nul
start "" "http://localhost:4173"

cd /d "%~dp0frontend"
npx vite preview --port 4173
