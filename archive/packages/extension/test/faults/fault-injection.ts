/** Port method keys used for actuator/sensor fault injection in tests. */
export type PortMethod =
  | "vscodeConfig.readConfiguration"
  | "vscodeConfig.executeUpdate"
  | "fs.ensureDir"
  | "fs.exists"
  | "assets.isInstallationComplete"
  | "assets.materialize"
  | "process.spawn"
  | "process.kill"
  | "docker.run"
  | "docker.stop"
  | "docker.imageExists"
  | "docker.pullImage"
  | "network.probe"
  | "tcp.connect"
  | "tcp.enroll"
  | "tcp.disconnect"
  | "tcp.close"
  | "panel.render";

export type FaultMode = "return-error" | "throw";

export interface FaultSpec {
  mode: FaultMode;
  message?: string;
}

export class FaultRegistry {
  private readonly faults = new Map<PortMethod, FaultSpec>();

  set(method: PortMethod, spec: FaultSpec): void {
    this.faults.set(method, spec);
  }

  clear(method?: PortMethod): void {
    if (method) this.faults.delete(method);
    else this.faults.clear();
  }

  get(method: PortMethod): FaultSpec | undefined {
    return this.faults.get(method);
  }
}

export function applyFaultSync<T>(registry: FaultRegistry, method: PortMethod, action: () => T): T {
  const fault = registry.get(method);
  if (!fault) return action();
  if (fault.mode === "throw") {
    throw new Error(fault.message ?? `injected fault: ${method}`);
  }
  return returnErrorFor(method, fault.message) as T;
}

export async function applyFault<T>(registry: FaultRegistry, method: PortMethod, action: () => T | Promise<T>): Promise<T> {
  const fault = registry.get(method);
  if (!fault) return action();
  if (fault.mode === "throw") {
    throw new Error(fault.message ?? `injected fault: ${method}`);
  }
  return returnErrorFor(method, fault.message) as T;
}

function returnErrorFor(method: PortMethod, message = "injected fault"): unknown {
  switch (method) {
    case "tcp.connect":
      return { ok: false, error: message };
    case "tcp.enroll":
    case "tcp.disconnect":
      return { ok: false, error: message, completion: "error" };
    case "network.probe":
      return { reachable: false, error: message };
    case "docker.imageExists":
    case "assets.isInstallationComplete":
    case "fs.exists":
      return false;
    case "vscodeConfig.readConfiguration":
      throw new Error(message);
    case "tcp.close":
    case "panel.render":
      return undefined;
    case "fs.ensureDir":
    case "assets.materialize":
    case "docker.pullImage":
    case "docker.run":
    case "process.spawn":
    case "process.kill":
      throw new Error(message);
    default:
      throw new Error(`return-error not defined for ${method}`);
  }
}

export function assertNotFatal(state: string): void {
  if (state === "FatalErrorState") {
    throw new Error("state machine entered FatalErrorState — port fault was not handled");
  }
}
