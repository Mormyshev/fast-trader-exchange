/** Align with DB enum VerificationStatus */
export const VERIFICATION_STATUSES = [
  "not_started",
  "pending",
  "verified",
  "rejected",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Legacy app value → DB value */
export function normalizeVerificationStatus(
  value: string | null | undefined,
): VerificationStatus {
  if (value === "on_check") return "pending";
  if (
    value === "not_started" ||
    value === "pending" ||
    value === "verified" ||
    value === "rejected"
  ) {
    return value;
  }
  return "not_started";
}

export function canEditVerification(status: VerificationStatus): boolean {
  return status === "not_started" || status === "rejected";
}

export function isVerificationComplete(status: VerificationStatus): boolean {
  return status === "verified";
}
