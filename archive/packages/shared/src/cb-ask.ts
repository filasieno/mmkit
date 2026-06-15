import { encodeCbString } from "./cb-tcp";

/** Builtin query — `Class` exists in every fresh cbserver database. */
export const CONNECTION_TEST_ASK_QUERY = "exists[Class/objname]";

export type AskFormat = "OBJNAMES" | "FRAMES";

/** ASK ipc payload: Format, Query, AnswerRep, RollbackTime (Format is unencoded). */
export function buildAskPayload(
  query: string,
  askFormat: AskFormat = "OBJNAMES",
  answerRep = "LABEL",
  rollbackTime = "Now"
): string {
  return `${askFormat},${encodeCbString(query)},${encodeCbString(answerRep)},${encodeCbString(rollbackTime)}`;
}

/** True when a LABEL answer to `exists[Class/objname]` indicates success. */
export function isExistsClassYes(reply: string | undefined): boolean {
  if (!reply) return false;
  const normalized = reply.trim().toLowerCase();
  return normalized === "yes" || normalized.includes('"yes"');
}
