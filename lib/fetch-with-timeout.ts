/** Tempo máximo padrão para evitar fetch pendente indefinidamente (browser / Supabase). */
export const DEFAULT_FETCH_TIMEOUT_MS = 25_000;

function mergeAbortSignals(
  upstream: AbortSignal | null | undefined,
  deadline: AbortSignal
): AbortSignal {
  if (!upstream) return deadline;
  if (upstream.aborted) return upstream;
  const anyFn = (
    AbortSignal as typeof AbortSignal & {
      any?: (signals: AbortSignal[]) => AbortSignal;
    }
  ).any;
  if (typeof anyFn === "function") {
    return anyFn([upstream, deadline]);
  }
  return deadline;
}

/**
 * `fetch` com abort por tempo; combina com `init.signal` quando `AbortSignal.any` existe.
 * Não altera corpo da resposta nem lógica de negócio — só limita espera.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  if (init?.signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), timeoutMs);
  try {
    const signal = mergeAbortSignals(init?.signal, deadline.signal);
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}
