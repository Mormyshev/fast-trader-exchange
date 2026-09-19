/** Relative in-app path only — blocks open redirects and javascript: URLs. */
export function isSafeInternalPath(
  next: string | null | undefined,
): next is string {
  if (!next) return false;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return false;
  }
  if (next.includes("://") || next.toLowerCase().startsWith("javascript:")) {
    return false;
  }
  return true;
}

export function safeInternalPath(
  next: string | null | undefined,
  fallback: string,
): string {
  return isSafeInternalPath(next) ? next : fallback;
}
