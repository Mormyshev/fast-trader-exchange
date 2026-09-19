import {
  createSignedStorageUrl,
  storageObjectPath,
} from "@/src/utils/storage/signed-url";

export function receiptsObjectPath(publicOrPath: string): string | null {
  return storageObjectPath("receipts", publicOrPath);
}

export async function createReceiptsSignedUrl(
  admin: Parameters<typeof createSignedStorageUrl>[0],
  stored: string | null | undefined,
): Promise<string | null> {
  return createSignedStorageUrl(admin, "receipts", stored);
}
