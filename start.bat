@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   BYBIT SCREENER - Запуск в один клик
echo ========================================
echo.

if not exist "node_modules" (
  echo Установка зависимостей...
  call npm run install:all
  if errorlevel 1 (
    echo Ошибка установки. Проверьте наличие Node.js.
    pause
    exit /b 1
  )
  echo.
)

echo Запуск сервера и клиента...
echo После запуска откройте в браузере: http://localhost:5173
echo.
start "" http://localhost:5173
npm run start:all

pause
