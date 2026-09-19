export type SniffedFileKind =
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "pdf"
  | "mp4"
  | "webm";

function startsWith(bytes: Uint8Array, magic: number[]) {
  if (bytes.length < magic.length) return false;
  return magic.every((value, index) => bytes[index] === value);
}

export function sniffFileKind(bytes: Uint8Array): SniffedFileKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return "gif";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return "gif";
  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "mp4";
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  return null;
}

export function sniffedContentType(kind: SniffedFileKind): string {
  switch (kind) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
  }
}

export function sniffedExt(kind: SniffedFileKind): string {
  switch (kind) {
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "gif":
      return "gif";
    case "webp":
      return "webp";
    case "pdf":
      return "pdf";
    case "mp4":
      return "mp4";
    case "webm":
      return "webm";
  }
}
