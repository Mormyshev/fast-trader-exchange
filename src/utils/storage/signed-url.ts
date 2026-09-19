const BUCKETS = ["receipts", "verifications", "chat-attachments"] as const;
export type StorageBucket = (typeof BUCKETS)[number];

function isBucket(value: string): value is StorageBucket {
  return (BUCKETS as readonly string[]).includes(value);
}

/** Object path inside a bucket. Accepts raw path or old public/sign URL. */
export function storageObjectPath(
  bucket: StorageBucket,
  publicOrPath: string | null | undefined,
): string | null {
  const raw = publicOrPath?.trim();
  if (!raw) return null;

  if (!raw.includes("://") && !raw.includes("/object/")) {
    if (raw.includes("..") || raw.startsWith("/")) return null;
    return raw.replace(/^\/+/, "");
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const escaped = bucket.replace(/-/g, "\\-");
    const match = url.pathname.match(
      new RegExp(`/object/(?:public|sign)/${escaped}/(.+)$`),
    );
    if (!match?.[1]) return null;
    const path = decodeURIComponent(match[1]);
    if (!path || path.includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}

export async function createSignedStorageUrl(
  admin: {
    storage: {
      from: (bucket: string) => {
        createSignedUrl: (
          path: string,
          expiresIn: number,
        ) => Promise<{ data: { signedUrl?: string } | null; error: unknown }>;
      };
    };
  },
  bucket: StorageBucket,
  stored: string | null | undefined,
  expiresIn = 60 * 60,
): Promise<string | null> {
  const path = storageObjectPath(bucket, stored);
  if (!path) return null;
  const signed = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
  return signed.data?.signedUrl ?? null;
}

export async function signStoredUrls<T extends Record<string, unknown>>(
  admin: Parameters<typeof createSignedStorageUrl>[0],
  bucket: StorageBucket,
  row: T,
  keys: (keyof T)[],
): Promise<T> {
  const next = { ...row };
  await Promise.all(
    keys.map(async (key) => {
      const value = row[key];
      if (typeof value !== "string" || !value) return;
      const signed = await createSignedStorageUrl(admin, bucket, value);
      (next as Record<string, unknown>)[key as string] = signed;
    }),
  );
  return next;
}

export function assertKnownBucket(name: string): StorageBucket {
  if (!isBucket(name)) {
    throw new Error("Unknown storage bucket");
  }
  return name;
}
