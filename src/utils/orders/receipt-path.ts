export function receiptsObjectPath(publicOrPath: string): string | null {
  const raw = publicOrPath.trim();
  if (!raw) return null;

  if (!raw.includes("://") && !raw.includes("/object/")) {
    return raw.replace(/^\/+/, "");
  }

  try {
    const url = new URL(raw);
    const match = url.pathname.match(
      /\/object\/(?:public|sign)\/receipts\/(.+)$/,
    );
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  return null;
}
