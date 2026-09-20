@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo AI 播单编排工作台 - 一键启动
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 18+ : https://nodejs.org/
  pause
  exit /b 1
)

node scripts\start.mjs %*
echo.
pause
