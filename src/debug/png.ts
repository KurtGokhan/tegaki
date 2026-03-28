import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeUint32BE(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  // CRC covers type + data
  const crcData = chunk.subarray(4, 8 + data.length);
  writeUint32BE(chunk, 8 + data.length, crc32(crcData));
  return chunk;
}

/**
 * Encode a binary bitmap (0/1 values) as a grayscale PNG.
 * Foreground (1) becomes black, background (0) becomes white.
 */
export function bitmapToPNG(bitmap: Uint8Array, width: number, height: number): Uint8Array {
  // IHDR: width, height, bit depth 8, color type 0 (grayscale)
  const ihdr = new Uint8Array(13);
  writeUint32BE(ihdr, 0, width);
  writeUint32BE(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data: filter byte (0 = None) + pixel bytes per row
  const raw = new Uint8Array(height * (1 + width));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width);
    raw[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      raw[rowOffset + 1 + x] = bitmap[y * width + x] ? 0 : 255; // 1=black, 0=white
    }
  }

  const compressed = deflateSync(Buffer.from(raw));
  const idatData = new Uint8Array(compressed);

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(PNG_SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let offset = 0;
  png.set(PNG_SIGNATURE, offset);
  offset += PNG_SIGNATURE.length;
  png.set(ihdrChunk, offset);
  offset += ihdrChunk.length;
  png.set(idatChunk, offset);
  offset += idatChunk.length;
  png.set(iendChunk, offset);

  return png;
}
