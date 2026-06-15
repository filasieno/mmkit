/** Opt-in trace logging for cbserver IPC and actor steps (`MMKIT_CBSERVER_TRACE=1`). */
const enabled = (): boolean => process.env.MMKIT_CBSERVER_TRACE === "1";

export function cbTrace(step: string, detail?: Record<string, unknown>): void {
  if (!enabled()) {
    return;
  }
  const ts = new Date().toISOString();
  if (detail === undefined) {
    console.error(`[cb-trace ${ts}] ${step}`);
    return;
  }
  console.error(`[cb-trace ${ts}] ${step}`, JSON.stringify(detail));
}

export function cbTraceAnswer(label: string, answer: { ok: boolean; completion: string; term: string; result?: string }): void {
  cbTrace(label, {
    ok: answer.ok,
    completion: answer.completion,
    result: answer.result,
    term: answer.term.length > 200 ? `${answer.term.slice(0, 200)}…` : answer.term,
  });
}
