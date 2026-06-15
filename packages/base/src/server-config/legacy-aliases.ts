/**
 * Legacy `CBServer*` names kept for {@link @mmkit/server} actor code.
 * New code should use `IMmkitServerConfig` / `MmkitServerConfig` from this package.
 */
export type {
  MmkitServerCacheMode as CBServerCacheMode,
  MmkitServerCcMode as CBServerCcMode,
  MmkitServerConfigInit as CBServerConfigInit,
  MmkitServerDevCommand as CBServerDevCommand,
  MmkitServerEcaMode as CBServerEcaMode,
  MmkitServerEcaOptimizer as CBServerEcaOptimizer,
  MmkitServerModuleGeneration as CBServerModuleGeneration,
  MmkitServerModuleSeparator as CBServerModuleSeparator,
  MmkitServerMultiUserMode as CBServerMultiUserMode,
  MmkitServerOptimizerMode as CBServerOptimizerMode,
  MmkitServerRuleLabels as CBServerRuleLabels,
  MmkitServerSecurityLevel as CBServerSecurityLevel,
  MmkitServerServerMode as CBServerServerMode,
  MmkitServerStratificationMode as CBServerStratificationMode,
  MmkitServerTraceMode as CBServerTraceMode,
  MmkitServerUntellMode as CBServerUntellMode,
  MmkitServerUpdateMode as CBServerUpdateMode,
  MmkitServerViewsMaintenance as CBServerViewsMaintenance,
  IMmkitServerActorSettings as ICBServerMmkitSettings,
  IMmkitServerLaunchRequest as ICBServerLaunchRequest,
  IMmkitServerLaunchSettings as ICBServerLaunchSettings,
  IMmkitServerNetworkSettings as ICBServerNetworkSettings,
  IMmkitServerPathSettings as ICBServerPathSettings,
  IMmkitServerRuntimeSettings as ICBServerRuntimeSettings,
} from "./MmkitServerConfig";

export {
  MmkitServerConfig as CBServerConfig,
  buildLaunchRequest,
  MMKIT_SERVER_OPTIMIZER_MODES as CB_SERVER_OPTIMIZER_MODES,
  MMKIT_SERVER_SECURITY_LEVELS as CB_SERVER_SECURITY_LEVELS,
  MMKIT_SERVER_TRACE_MODES as CB_SERVER_TRACE_MODES,
  MMKIT_SERVER_UPDATE_MODES as CB_SERVER_UPDATE_MODES,
  DEFAULT_MMKIT_SERVER_LAUNCH as DEFAULT_CB_SERVER_LAUNCH,
  DEFAULT_MMKIT_SERVER_MMKIT as DEFAULT_CB_SERVER_MMKIT,
  DEFAULT_MMKIT_SERVER_NETWORK as DEFAULT_CB_SERVER_NETWORK,
  DEFAULT_MMKIT_SERVER_PATHS as DEFAULT_CB_SERVER_PATHS,
  DEFAULT_MMKIT_SERVER_RUNTIME as DEFAULT_CB_SERVER_RUNTIME,
} from "./MmkitServerConfig";
