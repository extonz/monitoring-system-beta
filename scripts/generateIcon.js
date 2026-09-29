const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a clean, refined Apple-style monochrome shield icon (32x32)
function createAppleShieldPNG() {
  const width = 32;
  const height = 32;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      const dx = Math.abs(x - 15.5) / 10.5;
      const dy = (y - 7) / 19;

      let outer = false;
      let inner = false;

      if (y >= 6 && y <= 26) {
        if (y < 16) {
          outer = dx <= 1.0;
          inner = dx <= 0.8;
        } else {
          const taper = 1.0 - Math.pow((y - 16) / 10.5, 1.4);
          const innerTaper = Math.max(0, taper - 0.22);
          outer = dx <= Math.max(0, taper);
          inner = dx <= innerTaper;
        }
      }

      // Checkmark inside shield
      let isCheck = false;
      if (y >= 13 && y <= 19) {
        if (x >= 12 && x <= 15 && y - x === 2) isCheck = true; // left arm
        if (x >= 15 && x <= 20 && x - y === 0) isCheck = true; // right arm
      }

      const isBorder = outer && (!inner || isCheck);

      if (isBorder) {
        // Apple clean pure white with soft anti-aliased alpha
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 235;
      } else {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const png = createAppleShieldPNG();
fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);
console.log('Apple-style icon generated at assets/icon.png');
