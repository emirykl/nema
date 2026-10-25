/**
 * Memoizes an async loader for `ttlMs`. Concurrent callers share one
 * in-flight request, and a failed refresh falls back to the last good value.
 * `{ fresh: true }` skips the cached value (still sharing an in-flight load).
 */
export function cached<T>(ttlMs: number, load: () => Promise<T>): (opts?: { fresh?: boolean }) => Promise<T> {
  let value: T | undefined;
  let expires = 0;
  let inflight: Promise<T> | undefined;

  return async (opts) => {
    if (!opts?.fresh && value !== undefined && Date.now() < expires) return value;
    inflight ??= load()
      .then((v) => {
        value = v;
        expires = Date.now() + ttlMs;
        return v;
      })
      .catch((err) => {
        if (value !== undefined) return value;
        throw err;
      })
      .finally(() => {
        inflight = undefined;
      });
    return inflight;
  };
}
