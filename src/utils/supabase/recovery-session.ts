export function sessionHasRecoveryAmr(
  accessToken: string | null | undefined,
): boolean {
  if (!accessToken) return false;
  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return false;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(globalThis.atob(padded)) as {
      amr?: Array<{ method?: string }>;
    };
    return (
      Array.isArray(payload.amr) &&
      payload.amr.some((entry) => entry?.method === "recovery")
    );
  } catch {
    return false;
  }
}
