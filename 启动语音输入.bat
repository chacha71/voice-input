@echo off
chcp 65001 >nul
title 语音输入服务
cd /d "%~dp0"
echo ╔════════════════════════════════╗
echo ║    🎤 语音输入服务启动中...   ║
echo ╚════════════════════════════════╝
echo.
call npm start
pause
