/**
 * Fetch wrapper with AbortController-based timeout.
 * Prevents HTTP requests from hanging indefinitely on flaky networks.
 * Respects an externally provided signal (e.g., from useEffect cleanup)
 * so callers can cancel in-flight requests.
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 10_000
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Combine timeout signal with any externally provided signal
  const signals = [timeoutController.signal];
  if (options?.signal) {
    signals.push(options.signal);
  }
  const combinedSignal = AbortSignal.any(signals);

  try {
    return await fetch(url, { ...options, signal: combinedSignal });
  } finally {
    clearTimeout(timeoutId);
  }
}
