type SupabaseErrorLike = {
  message?: string;
  details?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientSupabaseError(error: unknown): boolean {
  if (!error) return false;
  const supabaseError = error as SupabaseErrorLike;
  const text = `${supabaseError.message ?? ""} ${supabaseError.details ?? ""}`.toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("eai_again") ||
    text.includes("enotfound") ||
    text.includes("etimedout") ||
    text.includes("econnreset") ||
    text.includes("network request failed") ||
    text.includes("connection reset")
  );
}

export async function withSupabaseReadRetry<T>(
  query: () => PromiseLike<T>,
  maxRetries = 2
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      const result = await query();
      const maybeError = (result as { error?: unknown } | null)?.error;
      if (!isTransientSupabaseError(maybeError) || attempt >= maxRetries) {
        return result;
      }
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
    }

    const backoffMs = 250 * Math.pow(2, attempt);
    await sleep(backoffMs);
    attempt += 1;
  }
}
