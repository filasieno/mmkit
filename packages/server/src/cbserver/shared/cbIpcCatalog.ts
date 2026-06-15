/**
 * CBserver IPC methods and completions — from `IpcSyntax.typ`, `Server-Interface.typ`,
 * and `CInterface.typ` (`Completion` enum).
 *
 * General: TELL, UNTELL, TELL_MODEL, ASK, HYPO_ASK, NEXT_MESSAGE, ENROLL_ME, CANCEL_ME
 * Privileged: STOP_SERVER, REPORT_CLIENTS
 * Internal: LPI_CALL
 * Extensions used by libcbc/mmkit: RETELL, SET_MODULE_CONTEXT, GET_MODULE_CONTEXT,
 * GET_MODULE_PATH, NOTIFICATION_REQUEST
 */

/** ipcanswer completion values (`IpcSyntax.typ` + `CInterface.typ` CB_* + client-side). */
export const CB_IPC_COMPLETIONS = {
  OK: "ok",
  ERROR: "error",
  NOT_HANDLED: "not_handled",
  NOTIFICATION: "notification",
  TIMEOUT: "timeout",
  BROKEN: "broken",
} as const;

export type CBIpcCompletion = (typeof CB_IPC_COMPLETIONS)[keyof typeof CB_IPC_COMPLETIONS];

/**
 * Node.js `net.Socket` events (client) → `CBConnectionPort` → connection actor `onSocket*`.
 * @see https://nodejs.org/api/net.html#class-netsocket
 */
export const CB_NET_SOCKET_EVENTS = {
  CONNECT: "connect",
  READY: "ready",
  DATA: "data",
  DRAIN: "drain",
  END: "end",
  CLOSE: "close",
  ERROR: "error",
  TIMEOUT: "timeout",
  LOOKUP: "lookup",
  CONNECTION_ATTEMPT: "connectionAttempt",
  CONNECTION_ATTEMPT_FAILED: "connectionAttemptFailed",
  CONNECTION_ATTEMPT_TIMEOUT: "connectionAttemptTimeout",
} as const;

/** `net.Socket` events wired into the connection actor protocol. */
export const CB_CONNECTION_SOCKET_NOTIFICATIONS = [
  "onSocketConnect",
  "onSocketData",
  "onSocketDrain",
  "onSocketEnd",
  "onSocketClose",
  "onSocketError",
  "onSocketTimeout",
] as const;

/**
 * `child_process` ChildProcess + stdio stream events → `CBServerPort` → supervisor `on*`.
 * Tracked children are reaped on parent `exit` / `SIGINT` / `SIGTERM` / `SIGHUP` (`killCbserverProcessTree`).
 * @see https://nodejs.org/api/child_process.html#class-childprocess
 * @see https://nodejs.org/api/stream.html#class-streamreadable
 */
export const CB_CHILD_PROCESS_EVENTS = {
  SPAWN: "spawn",
  EXIT: "exit",
  CLOSE: "close",
  ERROR: "error",
  DISCONNECT: "disconnect",
} as const;

export const CB_STDIO_STREAM_EVENTS = {
  DATA: "data",
  END: "end",
  CLOSE: "close",
  ERROR: "error",
} as const;

/** Supervisor subprocess / log-reader notifications derived from the above. */
export const CB_SERVER_PROCESS_NOTIFICATIONS = [
  "onStdoutData",
  "onStdoutEnd",
  "onStdoutClose",
  "onStdoutStdioError",
  "onStderrData",
  "onStderrEnd",
  "onStderrClose",
  "onStderrStdioError",
  "onProcessExit",
  "onProcessClose",
  "onProcessError",
  "onDisconnect",
] as const;

export function isIpcTransportFailure(completion: string): boolean {
  // `broken` is a normal ipcanswer completion from cbserver, not a transport fault.
  return completion === CB_IPC_COMPLETIONS.TIMEOUT;
}

export function isIpcNotification(completion: string): boolean {
  return completion === CB_IPC_COMPLETIONS.NOTIFICATION;
}

export const CB_IPC_METHODS = {
  TELL: "TELL",
  UNTELL: "UNTELL",
  TELL_MODEL: "TELL_MODEL",
  ASK: "ASK",
  HYPO_ASK: "HYPO_ASK",
  ENROLL_ME: "ENROLL_ME",
  CANCEL_ME: "CANCEL_ME",
  NEXT_MESSAGE: "NEXT_MESSAGE",
  STOP_SERVER: "STOP_SERVER",
  REPORT_CLIENTS: "REPORT_CLIENTS",
  LPI_CALL: "LPI_CALL",
  RETELL: "RETELL",
  SET_MODULE_CONTEXT: "SET_MODULE_CONTEXT",
  GET_MODULE_CONTEXT: "GET_MODULE_CONTEXT",
  GET_MODULE_PATH: "GET_MODULE_PATH",
  NOTIFICATION_REQUEST: "NOTIFICATION_REQUEST",
} as const;

export type CBIpcMethod = (typeof CB_IPC_METHODS)[keyof typeof CB_IPC_METHODS];
