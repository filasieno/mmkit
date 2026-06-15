/**
 * CBserver TCP response framing (server → client).
 *
 * Asymmetric with requests (see `@mmkit/base` `lengthPrefix` / `Server-Interface.typ`):
 * - **Send (client → server):** `X` + 4-byte BE length + `ipcmessage(...).\n`
 * - **Receive (server → client):** ASCII `<len>\n` + `ipcanswer(...).` + trailing `\n`
 *
 * `len` is `strlen(term)` excluding the final newline. C (`send_message`) and Java
 * (`LocalCBclient.readAnswer`) read `len + 1` bytes after the length line.
 */

export function tryParseTcpLengthFrame(buffer: string): { consumed: number; body: string } | undefined {
  let offset: number = 0;
  while (offset < buffer.length && buffer[offset] === "\n") {
    offset += 1;
  }
  const rest: string = buffer.slice(offset);
  const newline: number = rest.indexOf("\n");
  if (newline < 0) {
    return undefined;
  }
  const len: number = Number.parseInt(rest.slice(0, newline), 10);
  if (!Number.isFinite(len) || len < 0) {
    return undefined;
  }
  const bodyStart: number = newline + 1;
  const frameEnd: number = bodyStart + len + 1;
  if (rest.length < frameEnd) {
    return undefined;
  }
  if (rest[bodyStart + len] !== "\n") {
    return undefined;
  }
  const body: string = rest.slice(bodyStart, bodyStart + len);
  return { consumed: offset + frameEnd, body };
}

/** Format a mock server response frame (matches `FileIO.ipc_write`). */
export function formatTcpLengthFrame(body: string): string {
  const term: string = body.endsWith("\n") ? body.slice(0, -1) : body;
  return `${Buffer.byteLength(term, "utf8")}\n${term}\n`;
}
