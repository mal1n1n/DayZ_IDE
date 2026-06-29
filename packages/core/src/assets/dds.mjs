import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export function readDdsHeader(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(148);
    const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
    return readDdsHeaderBuffer(header, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

export function readDdsHeaderBuffer(header, bytesRead = header.length) {
  if (bytesRead < 128 || header.toString("ascii", 0, 4) !== "DDS ") {
    return { readable: false, reason: "not-dds-header" };
  }

  const height = header.readUInt32LE(12);
  const width = header.readUInt32LE(16);
  const mipMapCount = header.readUInt32LE(28);
  const fourCc = header.toString("ascii", 84, 88).replace(/\0/g, "");
  const rgbBitCount = header.readUInt32LE(88);
  const dx10 = fourCc === "DX10" && bytesRead >= 148 ? readDx10Header(header, 128) : null;

  const result = {
    readable: true,
    width,
    height,
    mipMapCount,
    format: (dx10?.format ?? fourCc) || `${rgbBitCount}bpp`,
  };
  if (dx10) result.dxgiFormat = dx10.dxgiFormat;
  return result;
}

export function decodeDdsRgba(buffer) {
  if (buffer.length < 128 || buffer.toString("ascii", 0, 4) !== "DDS ") {
    throw new Error("Not a DDS file.");
  }

  const height = buffer.readUInt32LE(12);
  const width = buffer.readUInt32LE(16);
  const pitch = buffer.readUInt32LE(20);
  const fourCc = buffer.toString("ascii", 84, 88).replace(/\0/g, "");
  const rgbBitCount = buffer.readUInt32LE(88);
  const rMask = buffer.readUInt32LE(92);
  const gMask = buffer.readUInt32LE(96);
  const bMask = buffer.readUInt32LE(100);
  const aMask = buffer.readUInt32LE(104);
  const dx10 = fourCc === "DX10" ? readDx10Header(buffer, 128) : null;

  if (fourCc) {
    return decodeCompressedDdsRgba(buffer, {
      width,
      height,
      fourCc: dx10?.format ?? fourCc,
      dataOffset: dx10 ? 148 : 128,
    });
  }
  if (rgbBitCount !== 32) {
    throw new Error(`Only uncompressed 32bpp DDS is supported, got ${rgbBitCount}bpp.`);
  }

  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const sourcePitch = pitch >= rowBytes ? pitch : rowBytes;
  const dataOffset = 128;
  const requiredBytes = dataOffset + (sourcePitch * height);
  if (buffer.length < requiredBytes) {
    throw new Error("DDS pixel data is truncated.");
  }

  const masks = {
    r: createMaskReader(rMask || 0x00ff0000),
    g: createMaskReader(gMask || 0x0000ff00),
    b: createMaskReader(bMask || 0x000000ff),
    a: createMaskReader(aMask || 0xff000000),
  };
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = dataOffset + (y * sourcePitch) + (x * bytesPerPixel);
      const pixel = buffer.readUInt32LE(sourceOffset);
      const targetOffset = ((y * width) + x) * 4;
      rgba[targetOffset] = masks.r(pixel);
      rgba[targetOffset + 1] = masks.g(pixel);
      rgba[targetOffset + 2] = masks.b(pixel);
      rgba[targetOffset + 3] = aMask === 0 ? 255 : masks.a(pixel);
    }
  }

  return { width, height, rgba, format: "32bpp" };
}

function decodeCompressedDdsRgba(buffer, { width, height, fourCc, dataOffset = 128 }) {
  const format = normalizeFourCc(fourCc);
  const codec = compressedCodec(format);
  if (!codec) {
    throw new Error(`Unsupported compressed DDS format: ${fourCc}.`);
  }

  const bytesPerBlock = codec === "BC1" ? 8 : 16;
  const blockWidth = Math.ceil(width / 4);
  const blockHeight = Math.ceil(height / 4);
  const requiredBytes = dataOffset + (blockWidth * blockHeight * bytesPerBlock);
  if (buffer.length < requiredBytes) {
    throw new Error("DDS compressed pixel data is truncated.");
  }

  const rgba = Buffer.alloc(width * height * 4);
  let offset = dataOffset;
  for (let blockY = 0; blockY < blockHeight; blockY += 1) {
    for (let blockX = 0; blockX < blockWidth; blockX += 1) {
      if (codec === "BC1") {
        decodeDxtColorBlock(buffer, offset, rgba, width, height, blockX, blockY, true, null);
      } else if (codec === "BC2") {
        const alpha = decodeDxt3AlphaBlock(buffer, offset);
        decodeDxtColorBlock(buffer, offset + 8, rgba, width, height, blockX, blockY, false, alpha);
      } else {
        const alpha = decodeDxt5AlphaBlock(buffer, offset);
        decodeDxtColorBlock(buffer, offset + 8, rgba, width, height, blockX, blockY, false, alpha);
      }
      offset += bytesPerBlock;
    }
  }

  return { width, height, rgba, format };
}

function decodeDxtColorBlock(buffer, offset, rgba, width, height, blockX, blockY, allowOneBitAlpha, explicitAlpha) {
  const color0 = buffer.readUInt16LE(offset);
  const color1 = buffer.readUInt16LE(offset + 2);
  const colors = buildDxtColorTable(color0, color1, allowOneBitAlpha);
  const indices = buffer.readUInt32LE(offset + 4);

  for (let localY = 0; localY < 4; localY += 1) {
    for (let localX = 0; localX < 4; localX += 1) {
      const x = (blockX * 4) + localX;
      const y = (blockY * 4) + localY;
      if (x >= width || y >= height) continue;

      const pixelIndex = (localY * 4) + localX;
      const color = colors[(indices >>> (pixelIndex * 2)) & 0x03];
      const alpha = explicitAlpha ? explicitAlpha[pixelIndex] : color[3];
      const target = ((y * width) + x) * 4;
      rgba[target] = color[0];
      rgba[target + 1] = color[1];
      rgba[target + 2] = color[2];
      rgba[target + 3] = alpha;
    }
  }
}

function buildDxtColorTable(color0, color1, allowOneBitAlpha) {
  const first = decodeRgb565(color0);
  const second = decodeRgb565(color1);
  const colors = [
    [...first, 255],
    [...second, 255],
  ];

  if (color0 > color1 || !allowOneBitAlpha) {
    colors.push([
      Math.round(((2 * first[0]) + second[0]) / 3),
      Math.round(((2 * first[1]) + second[1]) / 3),
      Math.round(((2 * first[2]) + second[2]) / 3),
      255,
    ]);
    colors.push([
      Math.round((first[0] + (2 * second[0])) / 3),
      Math.round((first[1] + (2 * second[1])) / 3),
      Math.round((first[2] + (2 * second[2])) / 3),
      255,
    ]);
  } else {
    colors.push([
      Math.round((first[0] + second[0]) / 2),
      Math.round((first[1] + second[1]) / 2),
      Math.round((first[2] + second[2]) / 2),
      255,
    ]);
    colors.push([0, 0, 0, 0]);
  }
  return colors;
}

function decodeDxt3AlphaBlock(buffer, offset) {
  const alpha = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    const byte = buffer[offset + Math.floor(index / 2)];
    const nibble = index % 2 === 0 ? byte & 0x0f : byte >>> 4;
    alpha[index] = nibble * 17;
  }
  return alpha;
}

function decodeDxt5AlphaBlock(buffer, offset) {
  const alpha0 = buffer[offset];
  const alpha1 = buffer[offset + 1];
  const table = new Uint8Array(8);
  table[0] = alpha0;
  table[1] = alpha1;
  if (alpha0 > alpha1) {
    table[2] = Math.round(((6 * alpha0) + alpha1) / 7);
    table[3] = Math.round(((5 * alpha0) + (2 * alpha1)) / 7);
    table[4] = Math.round(((4 * alpha0) + (3 * alpha1)) / 7);
    table[5] = Math.round(((3 * alpha0) + (4 * alpha1)) / 7);
    table[6] = Math.round(((2 * alpha0) + (5 * alpha1)) / 7);
    table[7] = Math.round((alpha0 + (6 * alpha1)) / 7);
  } else {
    table[2] = Math.round(((4 * alpha0) + alpha1) / 5);
    table[3] = Math.round(((3 * alpha0) + (2 * alpha1)) / 5);
    table[4] = Math.round(((2 * alpha0) + (3 * alpha1)) / 5);
    table[5] = Math.round((alpha0 + (4 * alpha1)) / 5);
    table[6] = 0;
    table[7] = 255;
  }

  const alpha = new Uint8Array(16);
  let bits = 0n;
  for (let index = 0; index < 6; index += 1) {
    bits |= BigInt(buffer[offset + 2 + index]) << BigInt(index * 8);
  }
  for (let index = 0; index < 16; index += 1) {
    alpha[index] = table[Number((bits >> BigInt(index * 3)) & 0x07n)];
  }
  return alpha;
}

function decodeRgb565(value) {
  return [
    Math.round((((value >>> 11) & 0x1f) / 31) * 255),
    Math.round((((value >>> 5) & 0x3f) / 63) * 255),
    Math.round(((value & 0x1f) / 31) * 255),
  ];
}

function normalizeFourCc(value) {
  return String(value).replace(/\0/g, "").trim().toUpperCase();
}

function compressedCodec(format) {
  const normalized = normalizeFourCc(format);
  if (normalized === "DXT1" || normalized.startsWith("BC1")) return "BC1";
  if (normalized === "DXT3" || normalized.startsWith("BC2")) return "BC2";
  if (normalized === "DXT5" || normalized.startsWith("BC3")) return "BC3";
  return null;
}

function readDx10Header(buffer, offset) {
  if (buffer.length < offset + 20) {
    throw new Error("DDS DX10 header is truncated.");
  }
  const dxgiFormat = buffer.readUInt32LE(offset);
  return {
    dxgiFormat,
    resourceDimension: buffer.readUInt32LE(offset + 4),
    miscFlag: buffer.readUInt32LE(offset + 8),
    arraySize: buffer.readUInt32LE(offset + 12),
    miscFlags2: buffer.readUInt32LE(offset + 16),
    format: dxgiFormatName(dxgiFormat),
  };
}

function dxgiFormatName(format) {
  const names = new Map([
    [71, "BC1_UNORM"],
    [72, "BC1_UNORM_SRGB"],
    [74, "BC2_UNORM"],
    [75, "BC2_UNORM_SRGB"],
    [77, "BC3_UNORM"],
    [78, "BC3_UNORM_SRGB"],
    [80, "BC4_UNORM"],
    [83, "BC5_UNORM"],
    [95, "BC6H_UF16"],
    [96, "BC6H_SF16"],
    [98, "BC7_UNORM"],
    [99, "BC7_UNORM_SRGB"],
  ]);
  return names.get(format) ?? `DXGI_FORMAT_${format}`;
}

export function encodePngRgba({ width, height, rgba }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (stride + 1);
    scanlines[targetOffset] = 0;
    rgba.copy(scanlines, targetOffset + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function decodePngRgba(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < signature.length || !buffer.subarray(0, signature.length).equals(signature)) {
    throw new Error("Not a PNG file.");
  }

  let offset = signature.length;
  let header = null;
  const idatChunks = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error("PNG chunk is truncated.");
    const data = buffer.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  if (!header) throw new Error("PNG is missing IHDR.");
  if (header.bitDepth !== 8) throw new Error(`Only 8-bit PNG is supported, got ${header.bitDepth}.`);
  if (header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error("Unsupported PNG compression/filter/interlace settings.");
  }

  const channels = pngChannels(header.colorType);
  const rowBytes = header.width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const expectedBytes = (rowBytes + 1) * header.height;
  if (inflated.length < expectedBytes) throw new Error("PNG pixel data is truncated.");

  const raw = Buffer.alloc(rowBytes * header.height);
  let sourceOffset = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filterType = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = inflated[sourceOffset + x];
      const left = x >= channels ? raw[rowStart + x - channels] : 0;
      const up = y > 0 ? raw[rowStart + x - rowBytes] : 0;
      const upLeft = y > 0 && x >= channels ? raw[rowStart + x - rowBytes - channels] : 0;
      raw[rowStart + x] = unfilterByte(filterType, value, left, up, upLeft);
    }
    sourceOffset += rowBytes;
  }

  return {
    width: header.width,
    height: header.height,
    rgba: convertPngRawToRgba(raw, header.width, header.height, header.colorType, channels),
  };
}

export function readPngRgba(filePath) {
  return decodePngRgba(fs.readFileSync(filePath));
}

export function decodeDdsFileToPng(filePath, outPath) {
  const decoded = decodeDdsRgba(fs.readFileSync(filePath));
  const png = encodePngRgba(decoded);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  return {
    filePath,
    outPath,
    width: decoded.width,
    height: decoded.height,
    decoder: `native-dds-${String(decoded.format ?? "rgba").toLowerCase()}`,
  };
}

function pngChannels(colorType) {
  if (colorType === 0) return 1;
  if (colorType === 2) return 3;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  throw new Error(`Unsupported PNG color type: ${colorType}.`);
}

function unfilterByte(filterType, value, left, up, upLeft) {
  if (filterType === 0) return value;
  if (filterType === 1) return (value + left) & 0xff;
  if (filterType === 2) return (value + up) & 0xff;
  if (filterType === 3) return (value + Math.floor((left + up) / 2)) & 0xff;
  if (filterType === 4) return (value + paeth(left, up, upLeft)) & 0xff;
  throw new Error(`Unsupported PNG filter type: ${filterType}.`);
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

function convertPngRawToRgba(raw, width, height, colorType, channels) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const source = index * channels;
    const target = index * 4;
    if (colorType === 0) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source];
      rgba[target + 2] = raw[source];
      rgba[target + 3] = 255;
    } else if (colorType === 2) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source + 1];
      rgba[target + 2] = raw[source + 2];
      rgba[target + 3] = 255;
    } else if (colorType === 4) {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source];
      rgba[target + 2] = raw[source];
      rgba[target + 3] = raw[source + 1];
    } else {
      rgba[target] = raw[source];
      rgba[target + 1] = raw[source + 1];
      rgba[target + 2] = raw[source + 2];
      rgba[target + 3] = raw[source + 3];
    }
  }
  return rgba;
}

function createMaskReader(mask) {
  const shift = trailingZeros(mask);
  const bits = bitCount(mask);
  const max = (2 ** bits) - 1;
  return (pixel) => {
    if (!mask || max <= 0) return 0;
    return Math.round((((pixel & mask) >>> shift) / max) * 255);
  };
}

function trailingZeros(value) {
  if (value === 0) return 0;
  let count = 0;
  while (((value >>> count) & 1) === 0 && count < 32) count += 1;
  return count;
}

function bitCount(value) {
  let count = 0;
  let current = value >>> 0;
  while (current) {
    count += current & 1;
    current >>>= 1;
  }
  return count;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
