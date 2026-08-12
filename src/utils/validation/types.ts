export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validationOk(value: string): ValidationResult {
  return { ok: true, value };
}

export function validationError(error: string): ValidationResult {
  return { ok: false, error };
}
