/** Client command kinds routed through the connection command queue. */
export const CB_COMMAND_KINDS = [
  "tell",
  "tellTransactions",
  "untell",
  "retell",
  "tellModel",
  "ask",
  "hypoAsk",
  "lpicall",
  "prolog",
  "why",
  "cd",
  "pwd",
  "lm",
  "ls",
  "mkdir",
  "who",
  "sub",
  "show",
  "nextMessage",
  "stopServer",
  "reportClients",
  "notificationRequest",
  "getNotificationMessage",
] as const;

export type CBCommandKind = (typeof CB_COMMAND_KINDS)[number];

export type CBCommandChannel = "command" | "notification";

export type CBCommandParams =
  | { kind: "tell"; frames: string }
  | { kind: "tellTransactions"; frames: string }
  | { kind: "untell"; frames: string }
  | { kind: "retell"; untellFrames: string; tellFrames: string }
  | { kind: "tellModel"; files: string[] }
  | { kind: "ask"; query: string; queryFormat?: string; answerRep?: string; rollbackTime?: string }
  | { kind: "hypoAsk"; frames: string; query: string; queryFormat?: string; answerRep?: string; rollbackTime?: string }
  | { kind: "lpicall"; lpiCall: string }
  | { kind: "prolog"; statement: string }
  | { kind: "why" }
  | { kind: "cd"; modulePath?: string }
  | { kind: "pwd" }
  | { kind: "lm"; modulePath?: string }
  | { kind: "ls"; className?: string }
  | { kind: "mkdir"; moduleName: string }
  | { kind: "who" }
  | { kind: "sub" }
  | { kind: "show"; objectName: string }
  | { kind: "nextMessage"; messageType?: string }
  | { kind: "stopServer"; password: string }
  | { kind: "reportClients" }
  | { kind: "notificationRequest"; about: string; tool?: string }
  | { kind: "getNotificationMessage"; timeoutMs: number };

export function commandChannelForKind(kind: CBCommandKind): CBCommandChannel {
  return kind === "getNotificationMessage" ? "notification" : "command";
}
