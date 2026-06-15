/** Opt-in trace logging for cbserver IPC and actor steps (`MMKIT_CBSERVER_TRACE=1`). */
const enabled = (): boolean => process.env.MMKIT_CBSERVER_TRACE === "1";

type CbTraceAnswer = { ok: boolean; completion: string; term: string; result?: string };

function traceDetail(detail: Record<string, unknown> | CbTraceAnswer): Record<string, unknown> {
  if ("completion" in detail && "term" in detail && "ok" in detail) {
    const answer: CbTraceAnswer = detail as CbTraceAnswer;
    return {
      ok: answer.ok,
      completion: answer.completion,
      result: answer.result,
      term: answer.term.length > 200 ? `${answer.term.slice(0, 200)}…` : answer.term,
    };
  }
  return detail;
}

export function cbTrace(step: string, detail?: Record<string, unknown> | CbTraceAnswer): void {
  if (!enabled()) {
    return;
  }
  const ts: string = new Date().toISOString();
  if (detail === undefined) {
    console.error(`[cb-trace ${ts}] ${step}`);
    return;
  }
  console.error(`[cb-trace ${ts}] ${step}`, JSON.stringify(traceDetail(detail)));
}

export function cbTraceAnswer(label: string, answer: CbTraceAnswer): void {
  cbTrace(label, answer);
}
