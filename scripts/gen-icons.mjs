import { deflateSync } from 'zlib';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

function crc32(buf) {
  const table = Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const b of buf) crc = (table[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([u32(d.length), t, d, u32(crc32(Buffer.concat([t, d])))]);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function blendPixel(pixels, w, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= w || y >= w) return;
  const idx = (Math.round(y) * w + Math.round(x)) * 4;
  const a = Math.max(0, Math.min(1, alpha * (color[3] ?? 255) / 255));
  pixels[idx] = mix(pixels[idx], color[0], a);
  pixels[idx + 1] = mix(pixels[idx + 1], color[1], a);
  pixels[idx + 2] = mix(pixels[idx + 2], color[2], a);
  pixels[idx + 3] = 255;
}

function fillCircle(pixels, size, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= r2) blendPixel(pixels, size, x, y, color, 1);
    }
  }
}

function fillEllipse(pixels, size, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
      if (inside && y >= cy - ry * 0.18) blendPixel(pixels, size, x, y, color, 1);
    }
  }
}

function strokeLine(pixels, size, x1, y1, x2, y2, width, color) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.7);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(pixels, size, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
  }
}

function makePNG(size) {
  const pixels = new Uint8Array(size * size * 4);
  const radius = size / 5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cornerX = Math.min(x, size - 1 - x);
      const cornerY = Math.min(y, size - 1 - y);
      let alpha = 255;
      if (cornerX < radius && cornerY < radius) {
        const dist = Math.hypot(radius - cornerX - 0.5, radius - cornerY - 0.5);
        if (dist > radius) alpha = 0;
      }
      const t = (x + y) / (size * 2);
      pixels[idx] = mix(0x02, 0x0b, t);
      pixels[idx + 1] = mix(0x06, 0x1f, t);
      pixels[idx + 2] = mix(0x17, 0x4d, t);
      pixels[idx + 3] = alpha;
    }
  }

  const s = size / 512;
  const white = [248, 250, 252, 255];
  const slate = [51, 65, 85, 255];
  const blue = [96, 165, 250, 255];
  const cyan = [56, 189, 248, 255];
  const green = [52, 211, 153, 255];
  strokeLine(pixels, size, 96 * s, 376 * s, 416 * s, 376 * s, 22 * s, slate);
  strokeLine(pixels, size, 116 * s, 342 * s, 196 * s, 266 * s, 36 * s, cyan);
  strokeLine(pixels, size, 196 * s, 266 * s, 260 * s, 298 * s, 36 * s, blue);
  strokeLine(pixels, size, 260 * s, 298 * s, 392 * s, 144 * s, 36 * s, green);
  strokeLine(pixels, size, 344 * s, 144 * s, 392 * s, 144 * s, 30 * s, green);
  strokeLine(pixels, size, 392 * s, 144 * s, 392 * s, 192 * s, 30 * s, green);
  fillCircle(pixels, size, 188 * s, 164 * s, 42 * s, white);
  fillEllipse(pixels, size, 188 * s, 346 * s, 78 * s, 92 * s, white);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (size * 4 + 1) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeIcon(path, size) {
  mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  writeFileSync(path, makePNG(size));
}

writeIcon('public/icon-512.png', 512);
writeIcon('public/icon-192.png', 192);

if (existsSync('android/app/src/main/res')) {
  const androidSizes = [
    ['mipmap-mdpi', 48],
    ['mipmap-hdpi', 72],
    ['mipmap-xhdpi', 96],
    ['mipmap-xxhdpi', 144],
    ['mipmap-xxxhdpi', 192],
  ];
  for (const [dir, size] of androidSizes) {
    writeIcon(`android/app/src/main/res/${dir}/ic_launcher.png`, size);
    writeIcon(`android/app/src/main/res/${dir}/ic_launcher_foreground.png`, size);
    writeIcon(`android/app/src/main/res/${dir}/ic_launcher_round.png`, size);
  }
}

console.log('PowerGraph icons generated.');
