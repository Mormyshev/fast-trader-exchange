export type ReceiptUploadKind = "pdf" | "crypto";

const PDF = "application/pdf";
const JPEG = new Set(["image/jpeg", "image/jpg"]);
const PNG = "image/png";

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isPdfFile(file: File): boolean {
  return file.type === PDF || fileExt(file.name) === "pdf";
}

function isJpegFile(file: File): boolean {
  const ext = fileExt(file.name);
  return JPEG.has(file.type) || ext === "jpg" || ext === "jpeg";
}

function isPngFile(file: File): boolean {
  return file.type === PNG || fileExt(file.name) === "png";
}

export function receiptUploadKind(isCryptoTransfer: boolean): ReceiptUploadKind {
  return isCryptoTransfer ? "crypto" : "pdf";
}

export function isAllowedReceiptFile(
  file: File,
  kind: ReceiptUploadKind,
): boolean {
  if (isPdfFile(file)) return true;
  if (kind === "crypto" && (isJpegFile(file) || isPngFile(file))) {
    return true;
  }
  return false;
}

export function receiptAcceptAttr(kind: ReceiptUploadKind): string {
  return kind === "crypto"
    ? "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
    : "application/pdf,.pdf";
}

export function receiptFileHint(kind: ReceiptUploadKind): string {
  return kind === "crypto" ? "PDF, JPEG или PNG" : "PDF";
}

export function receiptRejectMessage(kind: ReceiptUploadKind): string {
  return kind === "crypto"
    ? "Прикрепите чек в формате PDF, JPEG или PNG"
    : "Прикрепите чек в формате PDF";
}

export function receiptContentType(file: File): string {
  if (JPEG.has(file.type)) return "image/jpeg";
  if (file.type === PNG) return PNG;
  if (file.type === PDF) return PDF;
  const ext = fileExt(file.name);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return PNG;
  return file.type || PDF;
}

export function receiptFileExt(file: File): string {
  if (JPEG.has(file.type)) return "jpg";
  if (file.type === PNG) return "png";
  if (file.type === PDF) return "pdf";
  const ext = fileExt(file.name);
  if (ext === "jpeg") return "jpg";
  if (ext === "jpg" || ext === "png" || ext === "pdf") return ext;
  return "pdf";
}
