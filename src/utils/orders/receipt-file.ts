import { sniffFileKind, sniffedContentType, sniffedExt } from "@/src/utils/files/magic";

export type ReceiptUploadKind = "pdf" | "crypto";

export function receiptUploadKind(isCryptoTransfer: boolean): ReceiptUploadKind {
  return isCryptoTransfer ? "crypto" : "pdf";
}

export function isAllowedReceiptBytes(
  bytes: Uint8Array,
  kind: ReceiptUploadKind,
): boolean {
  const sniffed = sniffFileKind(bytes);
  if (!sniffed) return false;
  if (sniffed === "pdf") return true;
  return kind === "crypto" && (sniffed === "jpeg" || sniffed === "png");
}

export function isAllowedReceiptFile(
  file: File,
  kind: ReceiptUploadKind,
): boolean {
  const name = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = file.type;
  if (type === "application/pdf" || name === "pdf") return true;
  if (kind === "crypto") {
    if (
      type === "image/jpeg" ||
      type === "image/jpg" ||
      name === "jpg" ||
      name === "jpeg"
    ) {
      return true;
    }
    if (type === "image/png" || name === "png") return true;
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

export function receiptContentTypeFromBytes(bytes: Uint8Array): string {
  const kind = sniffFileKind(bytes);
  return kind ? sniffedContentType(kind) : "application/pdf";
}

export function receiptFileExtFromBytes(bytes: Uint8Array): string {
  const kind = sniffFileKind(bytes);
  return kind ? sniffedExt(kind) : "pdf";
}

/** Client-side hint only; server must use byte sniffing. */
export function receiptContentType(file: File): string {
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "image/jpeg";
  if (file.type === "image/png") return "image/png";
  if (file.type === "application/pdf") return "application/pdf";
  return file.type || "application/pdf";
}

export function receiptFileExt(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpeg") return "jpg";
  if (ext === "jpg" || ext === "png" || ext === "pdf") return ext;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "pdf";
}
