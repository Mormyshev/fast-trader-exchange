import {
  sniffFileKind,
  sniffedContentType,
  sniffedExt,
} from "@/src/utils/files/magic";
import { createSignedStorageUrl } from "@/src/utils/storage/signed-url";

export function isAllowedChatAttachmentBytes(bytes: Uint8Array): boolean {
  return sniffFileKind(bytes) !== null;
}

export function chatAttachmentMetaFromBytes(bytes: Uint8Array) {
  const kind = sniffFileKind(bytes);
  if (!kind) return null;
  return {
    contentType: sniffedContentType(kind),
    ext: sniffedExt(kind),
  };
}

export async function signChatAttachmentUrl(
  admin: Parameters<typeof createSignedStorageUrl>[0],
  stored: string | null | undefined,
): Promise<string | null> {
  return createSignedStorageUrl(admin, "chat-attachments", stored);
}

export async function signChatMessages<
  T extends { attachment_url?: string | null },
>(
  admin: Parameters<typeof createSignedStorageUrl>[0],
  messages: T[],
): Promise<T[]> {
  return Promise.all(
    messages.map(async (message) => {
      if (!message.attachment_url) return message;
      const signed = await signChatAttachmentUrl(admin, message.attachment_url);
      return { ...message, attachment_url: signed };
    }),
  );
}

export async function signChatMessage<
  T extends { attachment_url?: string | null },
>(
  admin: Parameters<typeof createSignedStorageUrl>[0],
  message: T,
): Promise<T> {
  const [signed] = await signChatMessages(admin, [message]);
  return signed;
}
