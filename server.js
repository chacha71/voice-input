const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { WebSocketServer } = require('ws');
const os = require('os');
const { Bonjour } = require('bonjour-service');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

const PORT = 45678;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── 获取所有非内部 IPv4 地址 ───────────────────
function getAllIPs() {
  const nets = os.networkInterfaces();
  const result = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        result.push({ name, address: net.address });
      }
    }
  }
  return result;
}

// ── 写入 Windows 剪贴板 ────────────────────────
function copyToClipboard(text) {
  if (!text) return;
  try {
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API：返回所有可用地址
  if (req.url === '/api/urls') {
    const ips = getAllIPs();
    const urls = ips.map(({ name, address }) => ({
      name,
      url: `http://${address}:${PORT}`,
    }));
    const hostname = getHostname();
    urls.push({ name: 'mDNS', url: `http://${hostname}.local:${PORT}` });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ port: PORT, urls }));
    return;
  }

  // API：返回二维码图片
  if (req.url.startsWith('/api/qr?')) {
    const url = new URL(req.url, `http://localhost`).searchParams.get('url') || '';
    if (url) {
      QRCode.toBuffer(url, { width: 200, margin: 1, color: { dark: '#ece8e1', light: '#16161f00' } })
        .then(buf => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(buf); })
        .catch(() => { res.writeHead(400); res.end('bad url'); });
    } else {
      res.writeHead(400); res.end('no url');
    }
    return;
  }

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
        ws.send(JSON.stringify({ type: 'copied', time: Date.now() }));
      }
    } catch (_) {}
  });

  ws.on('close', () => console.log('📱 手机已断开'));
});

// ── 获取本机名称 ────────────────────────────────
function getHostname() {
  try {
    return os.hostname().split('.')[0].toLowerCase();
  } catch (_) {
    return 'voice-input';
  }
}

// ── 打印二维码 ──────────────────────────────────
function printQR(text, label) {
  console.log(`  ${label}`);
  qrcode.generate(text, { small: true }, (qr) => {
    // qrcode-terminal 自动打印，不用额外操作
  });
  console.log('');
}

// ── 启动 ───────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ips = getAllIPs();

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║      🎤  语音输入 → 电脑剪贴板      ║');
  console.log('╠══════════════════════════════════════╣');
  console.log('║                                      ║');
  console.log('║  📡 手机打开以下任意网址:            ║');
  console.log('║                                      ║');

  // ── 显示所有 IP ──
  ips.forEach(({ name, address }) => {
    const url = `http://${address}:${PORT}`;
    console.log(`║  ${url.padEnd(36)}║`);
    console.log(`║  ${`└─ ${name}`.padEnd(36)}║`);
  });

  console.log('║                                      ║');

  // ── mDNS 零配置 ──
  let mdnsUrl = null;
  try {
    const hostname = getHostname();
    const bonjour = new Bonjour();
    bonjour.publish({ name: `语音输入 (${hostname})`, type: 'http', port: PORT });
    mdnsUrl = `http://${hostname}.local:${PORT}`;
    console.log(`║  🌐 也试试这个（IP变了也能用）:      ║`);
    console.log(`║  ${mdnsUrl.padEnd(36)}║`);
    console.log(`║  └─ mDNS 自动发现                   ║`);
    console.log('║                                      ║');
  } catch (_) {}

  console.log('║  💡 连不上小贴士:                    ║');
  console.log('║  · 确保手机和电脑在同一个网络        ║');
  console.log('║  · 关掉 Windows 防火墙试试           ║');
  console.log('║  · 热点方案：电脑连你手机的热点      ║');
  console.log('║  · 校园网有隔离？用热点方案！        ║');
  console.log('║                                      ║');
  console.log('║  点麦克风按钮 → 说话                ║');
  console.log('║  文字自动到剪贴板 → Ctrl+V 粘贴     ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // ── 打印二维码（方便手机扫） ──
  console.log('📱 扫二维码打开（推荐）:');
  ips.forEach(({ name, address }) => {
    const url = `http://${address}:${PORT}`;
    console.log(`  ── ${name} ──`);
    qrcode.generate(url, { small: true });
    console.log('');
  });
  if (mdnsUrl) {
    console.log('  ── mDNS ──');
    qrcode.generate(mdnsUrl, { small: true });
    console.log('');
  }

  console.log('按 Ctrl+C 停止服务');
});
