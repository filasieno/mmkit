import type { EventEmitter } from "node:events";
import * as ihsm from "ihsm";
import type { CBServerConfig } from "./settings/CBServerSettings";
import type { CBConnectionActor } from "../connection/CBServerConnectionConfig";
import type { CBStderrLogReaderActor, StderrLogReaderMachineConfig } from "../stderrLogReader/CBServerStderrReaderConfig";
import type { CBStdoutLogReaderActor, StdoutLogReaderMachineConfig } from "../stdoutLogReader/CBServerStdoutLogReaderConfig";
import type { ICBConnection, ICBConnectionOptions, ProcessIoListener, ProcessSignal, StatusListener } from "../../shared/CBServerDefs";
import type { TcpConnectProbeOptions } from "./tcpPortProbe";
import type { CBConnectionContext } from "../connection/CBServerConnectionContext";
import type { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";

export type CBServerLogChildren = { stdoutLogReader: CBStdoutLogReaderActor; stderrLogReader: CBStderrLogReaderActor };
export type CBServerLastExit = { code: number | null; signal: NodeJS.Signals | null; errorMessage?: string };
export type LogReaderChildren = {
  stdoutLogReader: ihsm.ChildActor<StdoutLogReaderMachineConfig>;
  stderrLogReader: ihsm.ChildActor<StderrLogReaderMachineConfig>;
};

/** Mutable domain state contract for the CBServer supervisor HSM. */
export interface ICBServerContext {
  readonly config: CBServerConfig;
  readonly statusEvents: EventEmitter;
  readonly processIoEvents: EventEmitter;
  readonly connections: Map<string, CBConnectionActor>;
  processSubscription?: ihsm.Disposable;
  killGraceTimer?: number;
  pid?: number;
  shutdownRequested: boolean;
  children?: CBServerLogChildren;
  lastExit?: CBServerLastExit;
  serverMailbox?: ihsm.InboundActor<CBServerMachineConfig>;
  tcpPortProbeAttempt: number;
  tcpPortProbeRetryTimer?: number;
  pendingLogReaderInterrupts: number;
  recordLastExit(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void;
  resetForStart(): void;
  disposeProcess(): void;
  resetIdle(): void;
  resetShutdown(): void;
  allocConnectionId(): string;
  registerConnection(id: string, actor: CBConnectionActor): void;
  unregisterConnection(id: string): void;
  clearConnections(): void;
  beginDetachChildren(): void;
  dispatchInterruptToChildren(): void;
  noteLogReaderInterrupted(): void;
  allInterrupted(): boolean;
}

export interface CBServerNotifications {
  start(): void;
  stop(): void;
  requestShutdown(): void;
}

export interface CBServerServices {
  initialize(): Promise<void>;
  createConnection(options?: ICBConnectionOptions): Promise<ICBConnection>;
  subscribeStatus(listener: StatusListener): Promise<ihsm.Disposable>;
  subscribeProcessIo(listener: ProcessIoListener): Promise<ihsm.Disposable>;
  getCurrentStateName(): Promise<string>;
}

export interface CBServerInternalNotifications {
  onStdoutData(chunk: string): void;
  onStderrData(chunk: string): void;
  onStdoutEnd(): void;
  onStdoutClose(): void;
  onStderrEnd(): void;
  onStderrClose(): void;
  onStdoutStdioError(errorMessage: string): void;
  onStderrStdioError(errorMessage: string): void;
  onProcessExit(code: number | null, signal: NodeJS.Signals | null): void;
  onProcessClose(code: number | null, signal: NodeJS.Signals | null): void;
  onProcessError(errorMessage: string): void;
  onDisconnect(): void;
  onStderrLine(line: string): void;
  onStderrLogReaderInterrupted(): void;
  onStdoutLine(line: string): void;
  onStdoutLogReaderInterrupted(): void;
  onKillGraceElapsed(): void;
  onFailToStart(errorMessage: string): void;
  doStart(): void;
  doBeginStartup(): void;
  doTcpPortProbeStep(): void;
  onTcpPortProbeRetry(): void;
  doSpawnLogReaders(): void;
  doCloseAllConnections(): void;
  onConnectionChildClosed(): void;
  doSendSigterm(): void;
  doBeginDetach(): void;
  doDispatchInterrupt(): void;
  doFinalizeDetach(): void;
  doCompleteStop(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void;
}

export interface CBServerPortConfig {
  spawn(config: CBServerConfig): Promise<ihsm.ResultWithSubscription<number>>;
  kill(pid: number, signal?: ProcessSignal): Promise<void>;
  probeTcpConnect(options: TcpConnectProbeOptions): Promise<boolean>;
  armLogReaders(server: CBServerActorRef): Promise<LogReaderChildren>;
  spawnConnection( server: CBServerActorRef, context: CBConnectionContext, orchestratorPort: CBConnectionOrchestratorPort ): Promise<CBConnectionActor>;
}

/** ihsm Config bag for the CBServer supervisor actor. */
export interface CBServerMachineConfig {
  context: ICBServerContext;
  notifications: CBServerNotifications;
  services: CBServerServices;
  internalNotifications: CBServerInternalNotifications;
  port: CBServerPortConfig;
}

export type CBServerPort = ihsm.DomainPortOf<CBServerMachineConfig>;
export type CBServerPortInstance = ihsm.Port<typeof CBServerTop>;
export type CBServerPortHandle = ihsm.IPort<CBServerMachineConfig>;
export type CBServerMachinePortInput = ihsm.MachinePortInput<CBServerMachineConfig>;
export type CBServerActor = ihsm.ExternalActor<CBServerMachineConfig>;
export type CBServerActorRef = ihsm.InboundActor<CBServerMachineConfig>;

export class CBServerTop extends ihsm.TopState<CBServerMachineConfig> {
  protected _checkInvariant(): void {}
}
