export async function loadNativeTextureBitmap(texture) {
  if (!texture?.url) throw new Error("Native texture URL is missing.");

  const response = await fetch(texture.url);
  if (!response.ok) throw new Error(await textureFetchError(response));
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().startsWith("image/")) {
    return loadImageResponseBitmap(await response.blob(), texture);
  }

  const decoded = decodeDdsRgba(await response.arrayBuffer());
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const canvasContext = canvas.getContext("2d");
  canvasContext.putImageData(new ImageData(decoded.rgba, decoded.width, decoded.height), 0, 0);
  return {
    source: canvas,
    width: decoded.width,
    height: decoded.height,
    format: decoded.format,
  };
}

async function textureFetchError(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    const payload = await response.json().catch(() => null);
    if (payload?.error) return `Texture fetch failed: ${response.status} ${payload.error}`;
  }
  return `Texture fetch failed: ${response.status}`;
}

async function loadImageResponseBitmap(blob, texture) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      format: texture.format || blob.type || "image",
    };
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      format: texture.format || blob.type || "image",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function decodeDdsRgba(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  if (bytes.length < 128 || ascii(bytes, 0, 4) !== "DDS ") {
    throw new Error("Not a DDS-backed texture.");
  }

  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  const pitch = view.getUint32(20, true);
  const fourCc = ascii(bytes, 84, 4).replace(/\0/g, "");
  const rgbBitCount = view.getUint32(88, true);
  const rMask = view.getUint32(92, true);
  const gMask = view.getUint32(96, true);
  const bMask = view.getUint32(100, true);
  const aMask = view.getUint32(104, true);
  const dx10 = fourCc === "DX10" ? readDx10Header(view) : null;

  if (fourCc) {
    return decodeCompressedDdsRgba(view, {
      width,
      height,
      fourCc: dx10?.format ?? fourCc,
      dataOffset: dx10 ? 148 : 128,
    });
  }

  if (rgbBitCount !== 32) {
    throw new Error(`Only 32bpp uncompressed DDS is supported, got ${rgbBitCount}bpp.`);
  }

  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const sourcePitch = pitch >= rowBytes ? pitch : rowBytes;
  const dataOffset = 128;
  if (bytes.length < dataOffset + (sourcePitch * height)) {
    throw new Error("DDS pixel data is truncated.");
  }

  const masks = {
    r: createMaskReader(rMask || 0x00ff0000),
    g: createMaskReader(gMask || 0x0000ff00),
    b: createMaskReader(bMask || 0x000000ff),
    a: createMaskReader(aMask || 0xff000000),
  };
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = dataOffset + (y * sourcePitch) + (x * bytesPerPixel);
      const pixel = view.getUint32(sourceOffset, true);
      const target = ((y * width) + x) * 4;
      rgba[target] = masks.r(pixel);
      rgba[target + 1] = masks.g(pixel);
      rgba[target + 2] = masks.b(pixel);
      rgba[target + 3] = aMask === 0 ? 255 : masks.a(pixel);
    }
  }

  return { width, height, rgba, format: "32bpp" };
}

function decodeCompressedDdsRgba(view, { width, height, fourCc, dataOffset }) {
  const format = normalizeFourCc(fourCc);
  const codec = compressedCodec(format);
  if (!codec) throw new Error(`Unsupported compressed DDS format: ${fourCc}.`);

  const bytesPerBlock = codec === "BC1" ? 8 : 16;
  const blockWidth = Math.ceil(width / 4);
  const blockHeight = Math.ceil(height / 4);
  if (view.byteLength < dataOffset + (blockWidth * blockHeight * bytesPerBlock)) {
    throw new Error("DDS compressed pixel data is truncated.");
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  let offset = dataOffset;
  for (let blockY = 0; blockY < blockHeight; blockY += 1) {
    for (let blockX = 0; blockX < blockWidth; blockX += 1) {
      if (codec === "BC1") {
        decodeDxtColorBlock(view, offset, rgba, width, height, blockX, blockY, true, null);
      } else if (codec === "BC2") {
        const alpha = decodeDxt3AlphaBlock(view, offset);
        decodeDxtColorBlock(view, offset + 8, rgba, width, height, blockX, blockY, false, alpha);
      } else {
        const alpha = decodeDxt5AlphaBlock(view, offset);
        decodeDxtColorBlock(view, offset + 8, rgba, width, height, blockX, blockY, false, alpha);
      }
      offset += bytesPerBlock;
    }
  }

  return { width, height, rgba, format };
}

function decodeDxtColorBlock(view, offset, rgba, width, height, blockX, blockY, allowOneBitAlpha, explicitAlpha) {
  const color0 = view.getUint16(offset, true);
  const color1 = view.getUint16(offset + 2, true);
  const colors = buildDxtColorTable(color0, color1, allowOneBitAlpha);
  const indices = view.getUint32(offset + 4, true);

  for (let localY = 0; localY < 4; localY += 1) {
    for (let localX = 0; localX < 4; localX += 1) {
      const x = (blockX * 4) + localX;
      const y = (blockY * 4) + localY;
      if (x >= width || y >= height) continue;

      const pixelIndex = (localY * 4) + localX;
      const color = colors[(indices >>> (pixelIndex * 2)) & 0x03];
      const target = ((y * width) + x) * 4;
      rgba[target] = color[0];
      rgba[target + 1] = color[1];
      rgba[target + 2] = color[2];
      rgba[target + 3] = explicitAlpha ? explicitAlpha[pixelIndex] : color[3];
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

function decodeDxt3AlphaBlock(view, offset) {
  const alpha = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    const byte = view.getUint8(offset + Math.floor(index / 2));
    const nibble = index % 2 === 0 ? byte & 0x0f : byte >>> 4;
    alpha[index] = nibble * 17;
  }
  return alpha;
}

function decodeDxt5AlphaBlock(view, offset) {
  const alpha0 = view.getUint8(offset);
  const alpha1 = view.getUint8(offset + 1);
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
    bits |= BigInt(view.getUint8(offset + 2 + index)) << BigInt(index * 8);
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

function readDx10Header(view) {
  if (view.byteLength < 148) throw new Error("DDS DX10 header is truncated.");
  const dxgiFormat = view.getUint32(128, true);
  return {
    dxgiFormat,
    format: dxgiFormatName(dxgiFormat),
  };
}

function dxgiFormatName(format) {
  return new Map([
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
  ]).get(format) ?? `DXGI_FORMAT_${format}`;
}

function compressedCodec(format) {
  const normalized = normalizeFourCc(format);
  if (normalized === "DXT1" || normalized.startsWith("BC1")) return "BC1";
  if (normalized === "DXT3" || normalized.startsWith("BC2")) return "BC2";
  if (normalized === "DXT5" || normalized.startsWith("BC3")) return "BC3";
  return null;
}

function normalizeFourCc(value) {
  return String(value).replace(/\0/g, "").trim().toUpperCase();
}

function ascii(bytes, offset, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index] ?? 0);
  }
  return value;
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
