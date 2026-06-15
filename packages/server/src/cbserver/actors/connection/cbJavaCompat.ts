/**
 * Behaviors mirrored from Java `LocalCBclient` / `CBConnection` for API parity.
 */
import { decodeCbString } from "@mmkit/shared/dist/cb-tcp";
import type { CBAnswer } from "../../shared/CBServerDefs";
import { IpcAnswer } from "../../shared/CBServerDefs";

/** LocalCBclient.replaceCRLF — MS-DOS CR+LF → LF. */
export function replaceCrLf(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

const COMPLETION_RANK: Record<string, number> = {
  ok: 0,
  error: 1,
  notification: 2,
  not_handled: 3,
  timeout: 4,
  broken: 5,
};

/** CBanswer.mergeCBanswer — keep max severity completion, latest result/sender. */
export function mergeCbAnswers(current: CBAnswer, previous: CBAnswer | undefined): CBAnswer {
  if (previous === undefined) {
    return current;
  }
  const currentRank = COMPLETION_RANK[current.completion] ?? 0;
  const previousRank = COMPLETION_RANK[previous.completion] ?? 0;
  const completion = currentRank >= previousRank ? current.completion : previous.completion;
  return new IpcAnswer(current.term, completion === "ok", completion, current.result);
}

/**
 * LocalCBclient.tellTransactions — split `{---}` and normalize line endings.
 */
export async function tellTransactions(
  tellOne: (frames: string) => Promise<CBAnswer>,
  transactions: string,
): Promise<CBAnswer> {
  const normalized = replaceCrLf(transactions);
  if (!normalized.includes("{---}")) {
    return tellOne(normalized);
  }
  let merged: CBAnswer | undefined;
  for (const chunk of normalized.split("{---}")) {
    const trimmed = chunk.trim();
    if (trimmed === "") {
      continue;
    }
    const answer = await tellOne(trimmed);
    merged = mergeCbAnswers(answer, merged);
  }
  return merged ?? new IpcAnswer("", true, "ok", "yes");
}

/**
 * LocalCBclient.getErrorMessages — drain ERROR_REPORT queue via NEXT_MESSAGE.
 */
export async function collectErrorReports(
  nextMessage: (type: string) => Promise<CBAnswer>,
): Promise<CBAnswer> {
  const parts: string[] = [];
  let answer = await nextMessage("ERROR_REPORT");
  while (answer.result !== "empty_queue") {
    const decoded = decodeErrorReportPayload(answer.result);
    if (decoded !== undefined) {
      parts.push(decoded);
      answer = await nextMessage("ERROR_REPORT");
      continue;
    }
    break;
  }
  const text = parts.join("");
  return new IpcAnswer(text, true, "ok", text);
}

/** CBConnection.ask nil workaround for FRAME / LABEL answer representations. */
export function normalizeAskNilResult(answer: CBAnswer, answerRep?: string): CBAnswer {
  if (answer.result !== "nil") {
    return answer;
  }
  if (answerRep === "FRAME" || answerRep === "LABEL") {
    return new IpcAnswer(answer.term, answer.ok, answer.completion, "");
  }
  return answer;
}

function decodeErrorReportPayload(result: string | undefined): string | undefined {
  if (result === undefined || result === "empty_queue") {
    return undefined;
  }
  if (!result.startsWith("ipcmessage")) {
    return result;
  }
  const bracketStart = result.indexOf("[");
  const bracketEnd = result.lastIndexOf("]");
  if (bracketStart < 0 || bracketEnd <= bracketStart) {
    return undefined;
  }
  const inner = result.slice(bracketStart + 1, bracketEnd).trim();
  if (inner === "") {
    return "";
  }
  const decoded = decodeCbString(inner);
  return decoded ?? inner;
}
