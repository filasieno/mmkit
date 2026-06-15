/** Default per-assertion wait — keep below Mocha suite timeout. */
export const DEFAULT_POLL_TIMEOUT_MS = 8_000;

/** Sleep between poll iterations. */
export const DEFAULT_POLL_INTERVAL_MS = 25;

export interface PollUntilOptions {
  timeoutMs?: number;
  intervalMs?: number;
  label?: string;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll until `predicate` returns true or `timeoutMs` elapses.
 * Always rejects on timeout — never hangs indefinitely.
 */
export async function pollUntil(
  predicate: () => boolean | Promise<boolean>,
  options: PollUntilOptions = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const label = options.label ?? "condition";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }
    await delay(intervalMs);
  }

  throw new Error(`pollUntil timed out after ${timeoutMs}ms: ${label}`);
}

/**
 * Race `promise` against a hard timeout. Rejects if the promise does not settle in time.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`withTimeout(${label}) exceeded ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
