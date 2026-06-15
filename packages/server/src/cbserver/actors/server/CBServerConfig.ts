import * as ihsm from "ihsm";
import type { ICBServerContext } from "./CBServerContext";
import type { CBServerConfig } from "./settings/CBServerSettings";
import type {
  ICBConnection,
  ICBConnectionOptions,
  ProcessIoListener,
  ProcessSignal,
  StatusListener,
} from "../../shared/CBServerDefs";
import type { TcpListenProbeOptions } from "./tcpPortProbe";
import type { LogReaderChildren } from "./spawnLogReaderChildren";
import type { CBConnectionContext } from "../connection/CBServerConnectionContext";
import type { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";
import type { CBConnectionActor } from "../connection/CBServerConnectionConfig";

export {
  buildLaunchRequest,
  CBServerConfig,
  CB_SERVER_OPTIMIZER_MODES,
  CB_SERVER_SECURITY_LEVELS,
  CB_SERVER_TRACE_MODES,
  CB_SERVER_UPDATE_MODES,
  DEFAULT_CB_SERVER_LAUNCH,
  DEFAULT_CB_SERVER_MMKIT,
  DEFAULT_CB_SERVER_NETWORK,
  DEFAULT_CB_SERVER_PATHS,
  DEFAULT_CB_SERVER_RUNTIME,
} from "./settings/CBServerSettings";
export type {
  CBServerCacheMode,
  CBServerCcMode,
  CBServerConfigInit,
  CBServerDevCommand,
  CBServerEcaMode,
  CBServerEcaOptimizer,
  CBServerModuleGeneration,
  CBServerModuleSeparator,
  CBServerMultiUserMode,
  CBServerOptimizerMode,
  CBServerRuleLabels,
  CBServerSecurityLevel,
  CBServerServerMode,
  CBServerStratificationMode,
  CBServerTraceMode,
  CBServerUntellMode,
  CBServerUpdateMode,
  CBServerViewsMaintenance,
} from "./settings/CBServerSettings";
export {
  CB_SERVER_SETTING_META,
  CB_SERVER_SETTINGS_META_DOC,
} from "./settings/CBServerSettingMeta";
export type {
  CBServerSettingChangeClass,
  CBServerSettingGroup,
  CBServerSettingKind,
} from "./settings/CBServerSettingMeta";

/** ihsm Config bag for the CBServer supervisor actor. */
export interface CBServerMachineConfig {
  context: ICBServerContext;
  notifications: {
    start(): void;
    stop(): void;
    requestShutdown(): void;
  };
  services: {
    initialize(): Promise<void>;
    createConnection(options?: ICBConnectionOptions): Promise<ICBConnection>;
    subscribeStatus(listener: StatusListener): Promise<ihsm.Disposable>;
    subscribeProcessIo(listener: ProcessIoListener): Promise<ihsm.Disposable>;
    getCurrentStateName(): Promise<string>;
  };
  internalNotifications: {
    onSpawn(): void;
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
    doPromoteRunning(): void;
    doSpawnLogReaders(): void;
    doCloseAllConnections(): void;
    onConnectionChildClosed(): void;
    doStop(): void;
    doSendSigterm(): void;
    doArmKillGrace(): void;
    doBeginDetach(target: "stopped" | "shuttingDown"): void;
    doDispatchInterrupt(): void;
    doFinalizeDetach(): void;
    doCompleteStop(code: number | null, signal: NodeJS.Signals | null, errorMessage?: string): void;
  };
  port: {
    spawn(config: CBServerConfig): Promise<ihsm.ResultWithSubscription<number>>;
    kill(pid: number, signal?: ProcessSignal): Promise<void>;
    awaitTcpListen(
      options: TcpListenProbeOptions,
    ): Promise<void>;
    armLogReaders(
      server: CBServerActorRef,
    ): Promise<LogReaderChildren>;
    spawnConnection(
      server: CBServerActorRef,
      context: CBConnectionContext,
      orchestratorPort: CBConnectionOrchestratorPort,
    ): Promise<CBConnectionActor>;
  };
}

export type CBServerPort = ihsm.DomainPortOf<CBServerMachineConfig>;
/** Production {@link ihsm.Port} subclass (e.g. {@link CBServerPort}). */
export type CBServerPortInstance = ihsm.Port<typeof CBServerTop>;
/** Handle on {@link ihsm.HsmContext.port} — exposes `.actor` inbound mailbox. */
export type CBServerPortHandle = ihsm.IPort<CBServerMachineConfig>;
/** Argument type for {@link createCBServerActor}. */
export type CBServerMachinePortInput = ihsm.MachinePortInput<CBServerMachineConfig>;

/** Supervisor actor mailbox surfaces. */
export type CBServerActor = ihsm.ExternalActor<CBServerMachineConfig>;
export type CBServerActorRef = ihsm.InboundActor<CBServerMachineConfig>;

/** Root composite state — no handlers; descendants define behavior. */
export class CBServerTop extends ihsm.TopState<CBServerMachineConfig> {
  protected _checkInvariant(): void {}
}
