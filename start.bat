@echo off
chcp 65001 >nul
echo 🎤 语音输入服务启动中...
cd /d "%~dp0"
node server.js
pause
