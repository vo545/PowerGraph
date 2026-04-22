import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

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

function makePNG(size) {
  const W = size, H = size;
  const pixels = new Uint8Array(W * H * 4);

  // Background: #0f172a
  for (let i = 0; i < W * H; i++) {
    pixels[i * 4]     = 0x0f;
    pixels[i * 4 + 1] = 0x17;
    pixels[i * 4 + 2] = 0x2a;
    pixels[i * 4 + 3] = 0xff;
  }

  // Rounded rectangle mask (icon shape), radius = size/5
  const r = Math.round(size / 5);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = Math.min(x, W - 1 - x);
      const cy = Math.min(y, H - 1 - y);
      if (cx < r && cy < r) {
        const dist = Math.hypot(r - cx - 0.5, r - cy - 0.5);
        if (dist > r) {
          const idx = (y * W + x) * 4;
          pixels[idx + 3] = 0; // transparent corner
        }
      }
    }
  }

  // Lightning bolt — polygon from SVG scaled to [size x size] (original viewBox 512x512)
  const scale = size / 512;
  const boltPts = [
    [300, 60], [180, 280], [256, 280], [212, 452], [332, 232], [256, 232],
  ].map(([x, y]) => [x * scale, y * scale]);

  const minY = Math.floor(Math.min(...boltPts.map(p => p[1])));
  const maxY = Math.ceil(Math.max(...boltPts.map(p => p[1])));
  const n = boltPts.length;

  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = boltPts[i];
      const [x2, y2] = boltPts[(i + 1) % n];
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k < xs.length - 1; k += 2) {
      const x0 = Math.max(0, Math.round(xs[k]));
      const x1 = Math.min(W - 1, Math.round(xs[k + 1]));
      for (let x = x0; x <= x1; x++) {
        // Gradient: top = #60a5fa, bottom = #a78bfa
        const t = (y - minY) / (maxY - minY);
        const idx = (y * W + x) * 4;
        pixels[idx]     = Math.round(0x60 + t * (0xa7 - 0x60));
        pixels[idx + 1] = Math.round(0xa5 + t * (0x8b - 0xa5));
        pixels[idx + 2] = Math.round(0xfa + t * (0xfa - 0xfa));
        pixels[idx + 3] = 0xff;
      }
    }
  }

  // Build PNG binary
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  // bytes 10-12 = 0

  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0; // filter: None
    for (let x = 0; x < W; x++) {
      const src = (y * W + x) * 4;
      const dst = y * (W * 4 + 1) + 1 + x * 4;
      raw[dst]     = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const idat = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-512.png', makePNG(512));
writeFileSync('public/icon-192.png', makePNG(192));
console.log('Icons generated: public/icon-512.png, public/icon-192.png');
