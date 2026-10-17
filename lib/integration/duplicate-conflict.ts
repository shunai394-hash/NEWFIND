/** Normalize PostgREST/Postgres unique-conflict errors across runtime wrappers. */
export function isDuplicateKeyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown };
  if (value.code === "23505") return true;
  return typeof value.message === "string"
    && /duplicate key value violates unique constraint/i.test(value.message);
}
