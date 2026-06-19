/** Extract a readable message from anything thrown (Error, Supabase PostgrestError, etc.). */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string") {
      return o.hint ? `${o.message} (${o.hint})` : o.message;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
