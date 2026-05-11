// ── 生成 PWA 图标（纯色圆形） ──────────────────
const fs = require('fs');
const path = require('path');

function createPNG(size) {
  // 最小 PNG：红色圆形，用 raw 像素数据
  // 这里用最简单方式——输出一个用 canvas 风格的纯色 PNG
  // 但 Node.js 没有原生 canvas，我们用 base64 内嵌一个最小 PNG

  // 生成一个纯色圆形的简单 PNG（用 zlib + 手动构造）
  const { deflateSync } = require('zlib');

  const width = size;
  const height = size;
  const color = [78, 205, 196]; // #4ecdc4 青色

  // 构造 raw 像素数据（RGBA）
  const rawData = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const r = width / 2 - 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
      const idx = (y * width + x) * 4;
      if (dist <= r) {
        rawData[idx] = color[0];
        rawData[idx + 1] = color[1];
        rawData[idx + 2] = color[2];
        rawData[idx + 3] = 255;
      } else {
        rawData[idx + 3] = 0; // 透明
      }
    }
  }

  // 过滤 + 压缩
  const filtered = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    filtered[y * (1 + width * 4)] = 0; // filter None
    rawData.copy(filtered, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = deflateSync(filtered);

  // 构造 PNG
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crc]);
  }

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  return png;
}

// 生成两个尺寸
const dir = path.join(__dirname, 'public');
fs.writeFileSync(path.join(dir, 'icon-192.png'), createPNG(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), createPNG(512));
console.log('✅ PWA 图标已生成');
