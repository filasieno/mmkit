/**
 * Mock dispatch cases — command channel IPC (orchestrator → command socket).
 */
import { CB_IPC_METHODS } from "../../src/cbserver/shared/cbIpcCatalog";
import type { CBCommandRequest } from "../../src/cbserver/actors/connection/CBCommandRequest";

type MockConnectionCall = {
  tell(frames: string): Promise<CBCommandRequest>;
  untell(frames: string): Promise<CBCommandRequest>;
  retell(untellFrames: string, tellFrames: string): Promise<CBCommandRequest>;
  tellModel(...files: string[]): Promise<CBCommandRequest>;
  ask(query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBCommandRequest>;
  hypoAsk(frames: string, query: string, queryFormat?: string, answerRep?: string, rollbackTime?: string): Promise<CBCommandRequest>;
  lpicall(lpiCall: string): Promise<CBCommandRequest>;
  prolog(statement: string): Promise<CBCommandRequest>;
  why(): Promise<CBCommandRequest>;
  cd(modulePath?: string): Promise<CBCommandRequest>;
  pwd(): Promise<CBCommandRequest>;
  lm(modulePath?: string): Promise<CBCommandRequest>;
  ls(className?: string): Promise<CBCommandRequest>;
  mkdir(moduleName: string): Promise<CBCommandRequest>;
  who(): Promise<CBCommandRequest>;
  sub(): Promise<CBCommandRequest>;
  show(objectName: string): Promise<CBCommandRequest>;
  nextMessage(messageType?: string): Promise<CBCommandRequest>;
  reportClients(): Promise<CBCommandRequest>;
  notificationRequest(about: string, tool?: string): Promise<CBCommandRequest>;
  getNotificationMessage(timeoutMs?: number): Promise<CBCommandRequest>;
};

export type MockDispatchActor = { call: MockConnectionCall };

export type MockNotificationActor = { call: Pick<MockConnectionCall, "getNotificationMessage"> };

export type MockDispatchCase = {
  label: string;
  ipc: string;
  run: (actor: MockDispatchActor) => Promise<CBCommandRequest>;
};

export const MOCK_COMMAND_CHANNEL_DISPATCH_CASES: MockDispatchCase[] = [
  { label: "tell", ipc: CB_IPC_METHODS.TELL, run: (a) => a.call.tell("frame.") },
  { label: "untell", ipc: CB_IPC_METHODS.UNTELL, run: (a) => a.call.untell("frame.") },
  { label: "retell", ipc: CB_IPC_METHODS.RETELL, run: (a) => a.call.retell("u.", "t.") },
  { label: "tellModel", ipc: CB_IPC_METHODS.TELL_MODEL, run: (a) => a.call.tellModel("m.mod") },
  {
    label: "ask",
    ipc: CB_IPC_METHODS.ASK,
    run: (a) => a.call.ask("q", "OBJNAMES", "FRAME", "Now"),
  },
  {
    label: "hypoAsk",
    ipc: CB_IPC_METHODS.HYPO_ASK,
    run: (a) => a.call.hypoAsk("f.", "q", "ASK", "default", "Now"),
  },
  { label: "lpicall", ipc: CB_IPC_METHODS.LPI_CALL, run: (a) => a.call.lpicall("PROLOG_CALL,getModulePath(_R)") },
  { label: "prolog", ipc: CB_IPC_METHODS.LPI_CALL, run: (a) => a.call.prolog("true") },
  { label: "why", ipc: CB_IPC_METHODS.NEXT_MESSAGE, run: (a) => a.call.why() },
  { label: "cd-set", ipc: CB_IPC_METHODS.SET_MODULE_CONTEXT, run: (a) => a.call.cd("/Root") },
  { label: "cd-get", ipc: CB_IPC_METHODS.GET_MODULE_CONTEXT, run: (a) => a.call.cd() },
  { label: "pwd", ipc: CB_IPC_METHODS.GET_MODULE_PATH, run: (a) => a.call.pwd() },
  { label: "lm", ipc: CB_IPC_METHODS.ASK, run: (a) => a.call.lm("Mod") },
  { label: "ls", ipc: CB_IPC_METHODS.ASK, run: (a) => a.call.ls("Employee") },
  { label: "mkdir", ipc: CB_IPC_METHODS.TELL, run: (a) => a.call.mkdir("Mod") },
  { label: "who", ipc: CB_IPC_METHODS.ASK, run: (a) => a.call.who() },
  { label: "sub", ipc: CB_IPC_METHODS.ASK, run: (a) => a.call.sub() },
  { label: "show", ipc: CB_IPC_METHODS.ASK, run: (a) => a.call.show("bill") },
  { label: "nextMessage", ipc: CB_IPC_METHODS.NEXT_MESSAGE, run: (a) => a.call.nextMessage("empty") },
  { label: "reportClients", ipc: CB_IPC_METHODS.REPORT_CLIENTS, run: (a) => a.call.reportClients() },
  {
    label: "notificationRequest",
    ipc: CB_IPC_METHODS.NOTIFICATION_REQUEST,
    run: (a) => a.call.notificationRequest("view(TestView)"),
  },
];

/** @deprecated Use {@link MOCK_COMMAND_CHANNEL_DISPATCH_CASES}. */
export const MOCK_DISPATCH_CASES = MOCK_COMMAND_CHANNEL_DISPATCH_CASES;

export function assertMockCommandChannelCoverage(ipcCovered: Set<string>): void {
  for (const testCase of MOCK_COMMAND_CHANNEL_DISPATCH_CASES) {
    if (!ipcCovered.has(testCase.ipc)) {
      throw new Error(`mock command catalog missing IPC coverage for ${testCase.ipc} (${testCase.label})`);
    }
  }
}

export const MOCK_NOTIFICATION_DISPATCH_CASES = [
  {
    label: "getNotificationMessage",
    run: (actor: MockNotificationActor) => { actor.call.getNotificationMessage(500); },
  },
] as const;
