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

function skipWs(term: string, index: number): number {
  let i = index;
  while (i < term.length && /\s/.test(term[i]!)) {
    i += 1;
  }
  return i;
}

function parseAtom(term: string, start: number): { value: string; end: number } | undefined {
  let i = start;
  while (i < term.length && /[A-Za-z0-9_]/.test(term[i]!)) {
    i += 1;
  }
  if (i === start) {
    return undefined;
  }
  return { value: term.slice(start, i), end: i };
}

/** Parse a CB double-quoted string with backslash escapes (incl. embedded newlines). */
function parseQuotedString(term: string, start: number): { value: string; end: number } | undefined {
  if (term[start] !== '"') {
    return undefined;
  }
  let i = start + 1;
  let value = "";
  while (i < term.length) {
    const ch = term[i]!;
    if (ch === "\\") {
      i += 1;
      if (i >= term.length) {
        return undefined;
      }
      const esc = term[i]!;
      if (esc === "n") {
        value += "\n";
      } else if (esc === "t") {
        value += "\t";
      } else if (esc === "r") {
        value += "\r";
      } else {
        value += esc;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      return { value, end: i + 1 };
    }
    value += ch;
    i += 1;
  }
  return undefined;
}

function parseTermArg(term: string, start: number): { value: string; end: number } | undefined {
  const i = skipWs(term, start);
  if (term[i] === '"') {
    return parseQuotedString(term, i);
  }
  return parseAtom(term, i);
}

/**
 * Parse `ipcanswer(sender, completion, returnData).` — handles multiline quoted results
 * (e.g. listModule / show FRAME answers) that regex cannot split reliably.
 */
export function parseAnswerTerm(term: string): ParsedAnswer {
  let i = skipWs(term, 0);
  const functor = parseAtom(term, i);
  if (functor === undefined || functor.value !== "ipcanswer") {
    return { completion: "broken" };
  }
  i = skipWs(term, functor.end);
  if (term[i] !== "(") {
    return { completion: "broken" };
  }
  i = skipWs(term, i + 1);

  const senderArg = parseTermArg(term, i);
  if (senderArg === undefined) {
    return { completion: "broken" };
  }
  i = skipWs(term, senderArg.end);
  if (term[i] !== ",") {
    return { completion: "broken" };
  }
  i = skipWs(term, i + 1);

  const status = parseAtom(term, i);
  if (status === undefined) {
    return { completion: "broken" };
  }
  i = skipWs(term, status.end);
  if (term[i] !== ",") {
    return { completion: "broken" };
  }
  i = skipWs(term, i + 1);

  const dataArg = parseTermArg(term, i);
  if (dataArg === undefined) {
    return { completion: "broken" };
  }
  i = skipWs(term, dataArg.end);
  i = skipWs(term, i);
  if (term[i] !== ")") {
    return { completion: "broken" };
  }

  let completion: ParsedAnswer["completion"] = "broken";
  if (status.value === "ok") {
    completion = "ok";
  } else if (status.value === "error") {
    completion = "error";
  } else if (status.value === "not_handled") {
    completion = "not_handled";
  } else if (status.value === "notification") {
    completion = "notification";
  }

  return { completion, sender: senderArg.value, returnData: dataArg.value };
}

export function decodeCbString(token: string): string | undefined {
  if (!token.startsWith('"') || !token.endsWith('"')) {
    return token;
  }
  const parsed = parseQuotedString(token, 0);
  return parsed?.value;
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
