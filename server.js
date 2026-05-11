const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { WebSocketServer } = require('ws');
const os = require('os');

const PORT = 45678;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── 获取局域网 IP ──────────────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// ── 写入 Windows 剪贴板 ────────────────────────
function copyToClipboard(text) {
  if (!text) return;
  try {
    // 用 PowerShell 写入剪贴板，支持中文
    const escaped = text.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText('${escaped}')"`,
      { timeout: 5000 }
    );
  } catch (err) {
    console.error('剪贴板写入失败:', err.message);
  }
}

// ── HTTP 服务 ──────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS（手机端跨域）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 静态文件
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

// ── WebSocket 服务 ─────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('📱 手机已连接');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'text' && msg.text) {
        copyToClipboard(msg.text);
        console.log(`📝 收到: ${msg.text.slice(0, 40)}${msg.text.length > 40 ? '…' : ''}`);
        // 通知手机端已处理
        ws.send(JSON.stringify({ type: 'copied', time: Date.now() }));
      }
    } catch (_) {}
  });

  ws.on('close', () => console.log('📱 手机已断开'));
});

// ── 启动 ───────────────────────────────────────
const localIP = getLocalIP();
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║      🎤  语音输入 → 电脑剪贴板      ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  手机打开这个网址:                    ║`);
  console.log(`║  http://${localIP}:${PORT}              ║`);
  console.log('║                                      ║');
  console.log('║  点麦克风按钮 → 说话                ║');
  console.log('║  文字自动到剪贴板 → Ctrl+V 粘贴     ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('按 Ctrl+C 停止服务');
});
