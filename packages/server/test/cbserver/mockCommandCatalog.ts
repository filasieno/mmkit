/**
 * Mock dispatch cases — command channel IPC (orchestrator → command socket).
 */
import { CB_IPC_METHODS } from "../../src/cbserver/shared/cbIpcCatalog";

export type MockDispatchActor = {
  notify: {
    dispatchTell(frames: string): void;
    dispatchUntell(frames: string): void;
    dispatchRetell(untellFrames: string, tellFrames: string): void;
    dispatchTellModel(...files: string[]): void;
    dispatchAsk(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): void;
    dispatchHypoAsk( frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string ): void;
    dispatchLpicall(lpiCall: string): void;
    dispatchProlog(statement: string): void;
    dispatchWhy(): void;
    dispatchCd(modulePath?: string): void;
    dispatchPwd(): void;
    dispatchLm(modulePath?: string): void;
    dispatchLs(className?: string): void;
    dispatchMkdir(moduleName: string): void;
    dispatchWho(): void;
    dispatchSub(): void;
    dispatchShow(objectName: string): void;
    dispatchNextMessage(messageType?: string): void;
    dispatchReportClients(): void;
    dispatchNotificationRequest(about: string, tool?: string): void;
    dispatchStopServer(password?: string): void;
  };
};

export type MockNotificationActor = {
  notify: {
    dispatchGetNotificationMessage(timeoutMs?: number): void;
  };
};

export type MockDispatchCase = {
  label: string;
  ipc: string;
  run: (actor: MockDispatchActor) => void;
};

export const MOCK_COMMAND_CHANNEL_DISPATCH_CASES: MockDispatchCase[] = [
  { label: "tell", ipc: CB_IPC_METHODS.TELL, run: (a) => a.notify.dispatchTell("frame.") },
  { label: "untell", ipc: CB_IPC_METHODS.UNTELL, run: (a) => a.notify.dispatchUntell("frame.") },
  { label: "retell", ipc: CB_IPC_METHODS.RETELL, run: (a) => a.notify.dispatchRetell("u.", "t.") },
  { label: "tellModel", ipc: CB_IPC_METHODS.TELL_MODEL, run: (a) => a.notify.dispatchTellModel("m.mod") },
  {
    label: "ask",
    ipc: CB_IPC_METHODS.ASK,
    run: (a) => a.notify.dispatchAsk("q", "OBJNAMES", "FRAME", "Now"),
  },
  {
    label: "hypoAsk",
    ipc: CB_IPC_METHODS.HYPO_ASK,
    run: (a) => a.notify.dispatchHypoAsk("f.", "q", "ASK", "default", "Now"),
  },
  { label: "lpicall", ipc: CB_IPC_METHODS.LPI_CALL, run: (a) => a.notify.dispatchLpicall("PROLOG_CALL,getModulePath(_R)") },
  { label: "prolog", ipc: CB_IPC_METHODS.LPI_CALL, run: (a) => a.notify.dispatchProlog("true") },
  { label: "why", ipc: CB_IPC_METHODS.NEXT_MESSAGE, run: (a) => a.notify.dispatchWhy() },
  { label: "cd-set", ipc: CB_IPC_METHODS.SET_MODULE_CONTEXT, run: (a) => a.notify.dispatchCd("/Root") },
  { label: "cd-get", ipc: CB_IPC_METHODS.GET_MODULE_CONTEXT, run: (a) => a.notify.dispatchCd() },
  { label: "pwd", ipc: CB_IPC_METHODS.GET_MODULE_PATH, run: (a) => a.notify.dispatchPwd() },
  { label: "lm", ipc: CB_IPC_METHODS.ASK, run: (a) => a.notify.dispatchLm("Mod") },
  { label: "ls", ipc: CB_IPC_METHODS.ASK, run: (a) => a.notify.dispatchLs("Employee") },
  { label: "mkdir", ipc: CB_IPC_METHODS.TELL, run: (a) => a.notify.dispatchMkdir("Mod") },
  { label: "who", ipc: CB_IPC_METHODS.ASK, run: (a) => a.notify.dispatchWho() },
  { label: "sub", ipc: CB_IPC_METHODS.ASK, run: (a) => a.notify.dispatchSub() },
  { label: "show", ipc: CB_IPC_METHODS.ASK, run: (a) => a.notify.dispatchShow("bill") },
  { label: "nextMessage", ipc: CB_IPC_METHODS.NEXT_MESSAGE, run: (a) => a.notify.dispatchNextMessage("empty") },
  { label: "reportClients", ipc: CB_IPC_METHODS.REPORT_CLIENTS, run: (a) => a.notify.dispatchReportClients() },
  {
    label: "notificationRequest",
    ipc: CB_IPC_METHODS.NOTIFICATION_REQUEST,
    run: (a) => a.notify.dispatchNotificationRequest("view(TestView)"),
  },
];

/** @deprecated Use {@link MOCK_COMMAND_CHANNEL_DISPATCH_CASES}. */
export const MOCK_COMMAND_DISPATCH_CASES = MOCK_COMMAND_CHANNEL_DISPATCH_CASES;

export const MOCK_NOTIFICATION_CHANNEL_CASES = [
  { label: "getNotificationMessage", ipc: "notification-read" },
] as const;

export const MOCK_COMMAND_CHANNEL_IPC_METHODS = [
  CB_IPC_METHODS.TELL,
  CB_IPC_METHODS.UNTELL,
  CB_IPC_METHODS.TELL_MODEL,
  CB_IPC_METHODS.ASK,
  CB_IPC_METHODS.HYPO_ASK,
  CB_IPC_METHODS.NEXT_MESSAGE,
  CB_IPC_METHODS.REPORT_CLIENTS,
  CB_IPC_METHODS.LPI_CALL,
  CB_IPC_METHODS.RETELL,
  CB_IPC_METHODS.SET_MODULE_CONTEXT,
  CB_IPC_METHODS.GET_MODULE_CONTEXT,
  CB_IPC_METHODS.GET_MODULE_PATH,
  CB_IPC_METHODS.NOTIFICATION_REQUEST,
] as const;

/** @deprecated Use {@link MOCK_COMMAND_CHANNEL_IPC_METHODS}. */
export const MOCK_IPC_METHODS_EXCEPT_LIFECYCLE = MOCK_COMMAND_CHANNEL_IPC_METHODS;

export function assertMockCommandChannelCoverage(covered: Set<string>): void {
  for (const method of MOCK_COMMAND_CHANNEL_IPC_METHODS) {
    if (!covered.has(method)) {
      throw new Error(`missing mock command-channel IPC coverage: ${method}`);
    }
  }
}

/** @deprecated Use {@link assertMockCommandChannelCoverage}. */
export function assertMockIpcCoverage(covered: Set<string>): void {
  assertMockCommandChannelCoverage(covered);
}
