import path from "node:path";

export function parseImageSet(content, options = {}) {
  const filePath = options.filePath ?? null;
  const virtualPath = options.virtualPath ?? filePath;
  const fallbackName = filePath ? path.basename(filePath, ".imageset") : "imageset";
  const setName = content.match(/\bName\s+"([^"]+)"/)?.[1] ?? fallbackName;
  const refSizeMatch = content.match(/\bRefSize\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  const textureRefs = [...content.matchAll(/\bpath\s+"([^"]+)"/g)].map((match) => match[1]);
  const images = [];

  const imageBlockPattern = /ImageSetDefClass\s+(?:"([^"]+)"|([^\s{]+))\s*\{([\s\S]*?)\n\s*\}/g;
  for (const match of content.matchAll(imageBlockPattern)) {
    const block = match[3];
    const className = match[1] ?? match[2];
    const name = block.match(/\bName\s+"([^"]+)"/)?.[1] ?? className;
    const pos = block.match(/\bPos\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
    const size = block.match(/\bSize\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
    const flags = block.match(/\bFlags\s+(-?\d+)/)?.[1] ?? null;

    images.push({
      name,
      className,
      pos: pos ? [Number(pos[1]), Number(pos[2])] : null,
      size: size ? [Number(size[1]), Number(size[2])] : null,
      flags: flags === null ? null : Number(flags),
    });
  }

  return {
    filePath,
    virtualPath,
    name: setName,
    refSize: refSizeMatch ? [Number(refSizeMatch[1]), Number(refSizeMatch[2])] : null,
    textureRefs,
    images,
  };
}

export function parseSetImageRef(ref) {
  const match = String(ref).match(/^set:([^\s]+)\s+image:(.+)$/i);
  if (!match) return null;
  return { setName: match[1], imageName: match[2].trim() };
}
