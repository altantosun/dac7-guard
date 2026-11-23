/**
 * Zero-dependency PNG icon generator for DAC7 Guard (16x16, 48x48, 128x128).
 * Uses Node's built-in zlib module to write valid RGBA PNG files.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.22;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;

      // Normalized coordinates [-1, 1]
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;

      // Rounded square background mask
      const dx = Math.max(0, Math.abs(x + 0.5 - size / 2) - (size / 2 - r));
      const dy = Math.max(0, Math.abs(y + 0.5 - size / 2) - (size / 2 - r));
      const inRoundedRect = dx * dx + dy * dy <= r * r;

      if (!inRoundedRect) {
        buf[idx + 3] = 0;
        continue;
      }

      // Base dark slate (#0f172a)
      let R = 15;
      let G = 23;
      let B = 42;
      const A = 255;

      // Shield silhouette in emerald green (#22c55e)
      const shieldTop = ny >= -0.62 && ny <= 0.12 && Math.abs(nx) <= 0.56;
      const shieldBottom =
        ny > 0.12 && ny <= 0.68 && Math.abs(nx) <= 0.56 * (1 - (ny - 0.12) / 0.62);
      const inShield = shieldTop || shieldBottom;

      if (inShield) {
        R = 34;
        G = 197;
        B = 94;

        // Inner crisp dark shield accent + checkmark
        const innerTop = ny >= -0.48 && ny <= 0.08 && Math.abs(nx) <= 0.42;
        const innerBottom =
          ny > 0.08 && ny <= 0.52 && Math.abs(nx) <= 0.42 * (1 - (ny - 0.08) / 0.48);
        if (innerTop || innerBottom) {
          R = 22;
          G = 163;
          B = 74;
        }

        // White checkmark strokes
        const d1 = Math.abs(ny - (nx * 1.0 + 0.24));
        const leg1 = nx >= -0.26 && nx <= -0.02 && d1 <= 0.11;
        const d2 = Math.abs(ny - (-nx * 1.05 + 0.18));
        const leg2 = nx >= -0.04 && nx <= 0.3 && d2 <= 0.11;

        if (leg1 || leg2) {
          R = 255;
          G = 255;
          B = 255;
        }
      }

      buf[idx] = R;
      buf[idx + 1] = G;
      buf[idx + 2] = B;
      buf[idx + 3] = A;
    }
  }

  return encodePng(size, size, buf);
}

const outDir = path.resolve(process.cwd(), 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = drawIcon(size);
  const filePath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${filePath} (${png.length} bytes)`);
}
