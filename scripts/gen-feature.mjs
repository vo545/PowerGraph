import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';

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
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; }
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([u32(d.length), t, d, u32(crc32(Buffer.concat([t, d])))]);
}

function setPixel(pixels, W, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0) return;
  const i = (y * W + x) * 4;
  pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
}

function fillRect(pixels, W, H, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = Math.max(0,y1); y < Math.min(H,y2); y++)
    for (let x = Math.max(0,x1); x < Math.min(W,x2); x++)
      setPixel(pixels, W, x, y, r, g, b, a);
}

function fillPolygon(pixels, W, H, pts, cr, cg, cb) {
  const minY = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1]))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...pts.map(p => p[1]))));
  const n = pts.length;
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
      if ((y1 <= y && y < y2) || (y2 <= y && y < y1))
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k < xs.length - 1; k += 2) {
      const x0 = Math.max(0, Math.round(xs[k]));
      const x1 = Math.min(W - 1, Math.round(xs[k + 1]));
      for (let x = x0; x <= x1; x++) {
        const t = (y - minY) / (maxY - minY);
        setPixel(pixels, W, x, y,
          Math.round(cr[0] + t * (cr[1] - cr[0])),
          Math.round(cg[0] + t * (cg[1] - cg[0])),
          Math.round(cb[0] + t * (cb[1] - cb[0]))
        );
      }
    }
  }
}

// Minimal bitmap font — 5x7, characters: A-Z 0-9 space
const FONT = {
  'A': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,0,0,0,0]],
  'C': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
  'E': [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1],[0,0,0,0,0]],
  'F': [[1,1,1,1,1],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,0,0,0,0]],
  'G': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,1,1,1],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
  'H': [[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,0,0,0,0]],
  'I': [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,0,0,0]],
  'K': [[1,0,0,0,1],[1,0,0,1,0],[1,0,1,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0],[0,0,0,0,0]],
  'N': [[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,0,0,0,0]],
  'O': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0],[0,0,0,0,0]],
  'P': [[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,0,0,0,0]],
  'R': [[1,1,1,1,0],[1,0,0,0,1],[1,1,1,1,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1],[0,0,0,0,0]],
  'S': [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0],[0,0,0,0,1],[1,1,1,1,0],[0,0,0,0,0]],
  'T': [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,0,0,0]],
  'W': [[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1],[0,0,0,0,0]],
  ' ': [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
};

function drawText(pixels, W, H, text, startX, startY, scale, r, g, b) {
  let cx = startX;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col]) {
          fillRect(pixels, W, H,
            cx + col * scale, startY + row * scale,
            cx + col * scale + scale, startY + row * scale + scale,
            r, g, b
          );
        }
      }
    }
    cx += 6 * scale;
  }
}

const W = 1024, H = 500;
const pixels = new Uint8Array(W * H * 4);

// Background gradient: dark navy
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = x / W;
    const r = Math.round(0x0f + t * (0x0d - 0x0f));
    const g = Math.round(0x17 + t * (0x10 - 0x17));
    const b = Math.round(0x2a + t * (0x20 - 0x2a));
    setPixel(pixels, W, x, y, r, g, b);
  }
}

// Subtle radial glow top-left (blue)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 150, y - 100) / 400;
    if (d < 1) {
      const i = (y * W + x) * 4;
      const strength = (1 - d) * 0.18;
      pixels[i]   = Math.min(255, pixels[i]   + Math.round(0x3b * strength));
      pixels[i+1] = Math.min(255, pixels[i+1] + Math.round(0x82 * strength));
      pixels[i+2] = Math.min(255, pixels[i+2] + Math.round(0xf6 * strength));
    }
  }
}

// Subtle radial glow bottom-right (purple)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 900, y - 420) / 350;
    if (d < 1) {
      const i = (y * W + x) * 4;
      const strength = (1 - d) * 0.15;
      pixels[i]   = Math.min(255, pixels[i]   + Math.round(0x8b * strength));
      pixels[i+1] = Math.min(255, pixels[i+1] + Math.round(0x5c * strength));
      pixels[i+2] = Math.min(255, pixels[i+2] + Math.round(0xf6 * strength));
    }
  }
}

// Icon background circle
const cx = 200, cy = 250, radius = 130;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < radius) {
      const alpha = d > radius - 2 ? (radius - d) / 2 : 1;
      const i = (y * W + x) * 4;
      const bg = 0x1e;
      pixels[i]   = Math.round(pixels[i]   * (1-alpha) + bg * alpha);
      pixels[i+1] = Math.round(pixels[i+1] * (1-alpha) + bg * alpha);
      pixels[i+2] = Math.round(pixels[i+2] * (1-alpha) + 0x3a * alpha);
      pixels[i+3] = 255;
    }
  }
}

// Lightning bolt inside circle (scaled to fit ~200px tall centered at cx,cy)
const boltScale = 0.42;
const boltOx = cx - 512 * boltScale / 2 + 5;
const boltOy = cy - 512 * boltScale / 2;
const bolt = [
  [300,60],[180,280],[256,280],[212,452],[332,232],[256,232]
].map(([x,y]) => [boltOx + x*boltScale, boltOy + y*boltScale]);
fillPolygon(pixels, W, H, bolt, [0x60,0xa7],[0xa5,0x8b],[0xfa,0xfa]);

// Title text "POWERGRAPH"
drawText(pixels, W, H, 'POWERGRAPH', 380, 170, 8, 0xff, 0xff, 0xff);

// Subtitle text "FITNESS TRACKER"
drawText(pixels, W, H, 'FITNESS TRACKER', 380, 290, 4, 0x60, 0xa5, 0xfa);

// Decorative line under title
fillRect(pixels, W, H, 380, 270, 700, 273, 0x3b, 0x82, 0xf6);

// Build PNG
const sig = Buffer.from([137,80,78,71,13,10,26,10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
ihdr[8]=8; ihdr[9]=6;
const raw = Buffer.alloc(H*(1+W*4));
for (let y=0;y<H;y++) {
  raw[y*(W*4+1)]=0;
  for (let x=0;x<W;x++) {
    const s=(y*W+x)*4, d=y*(W*4+1)+1+x*4;
    raw[d]=pixels[s]; raw[d+1]=pixels[s+1]; raw[d+2]=pixels[s+2]; raw[d+3]=255;
  }
}
const png = Buffer.concat([sig,pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(raw,{level:6})),pngChunk('IEND',Buffer.alloc(0))]);
writeFileSync('public/feature.png', png);
console.log('Generated: public/feature.png (1024x500)');
