/** ConceptBase TCP framing — mirrors libcbc send_message / connect_CB_server. */

export function encodeCbString(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildIpcMessage(client: string, serverName: string, method: string, data: string): string {
  return `ipcmessage(${client},${serverName},${method},[${data}]).\n`;
}

export function lengthPrefix(message: string | Buffer): Buffer {
  const body = typeof message === "string" ? Buffer.from(message, "utf8") : message;
  const header = Buffer.alloc(5);
  const len = body.length;
  header[0] = "X".charCodeAt(0);
  header[1] = (len >>> 24) & 0xff;
  header[2] = (len >>> 16) & 0xff;
  header[3] = (len >>> 8) & 0xff;
  header[4] = len & 0xff;
  return Buffer.concat([header, body]);
}

export interface ParsedAnswer {
  completion: "ok" | "error" | "not_handled" | "notification" | "timeout" | "broken";
  sender?: string;
  returnData?: string;
}

/** Parse answer line format: length newline body (Prolog term). */
export function parseAnswerTerm(term: string): ParsedAnswer {
  const match = term.match(/^\s*(\w+)\s*\(\s*([^,]+)\s*,\s*(\w+)\s*,\s*(.+)\s*\)\s*\.?\s*$/);
  if (!match) {
    return { completion: "broken" };
  }
  const status = match[3];
  let completion: ParsedAnswer["completion"] = "broken";
  if (status === "ok") completion = "ok";
  else if (status === "error") completion = "error";
  else if (status === "not_handled") completion = "not_handled";
  else if (status === "notification") completion = "notification";

  const sender = match[2].trim();
  const dataRaw = match[4].trim();
  const returnData = decodeCbString(dataRaw);

  return { completion, sender, returnData };
}

export function decodeCbString(token: string): string | undefined {
  if (!token.startsWith('"') || !token.endsWith('"')) {
    return token;
  }
  return token
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export function buildEnrollPayload(toolName: string, userName: string): string {
  return `${encodeCbString(toolName)},${encodeCbString(userName)}`;
}

export interface CbAnswer {
  completion: ParsedAnswer["completion"];
  result?: string;
  respondingTool?: string;
  ok: boolean;
}

export function toCbAnswer(parsed: ParsedAnswer): CbAnswer {
  return {
    completion: parsed.completion,
    result: parsed.returnData,
    respondingTool: parsed.sender,
    ok: parsed.completion === "ok",
  };
}
