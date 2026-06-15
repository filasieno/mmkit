/** Port method keys for MmkitServerActor fault injection in lsp-server tests. */
export type ServerPortMethod =
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
  | "network.probe";

export type FaultMode = "return-error" | "throw";

export interface FaultSpec {
  mode: FaultMode;
  message?: string;
}

export class FaultRegistry {
  private readonly faults = new Map<ServerPortMethod, FaultSpec>();

  set(method: ServerPortMethod, spec: FaultSpec): void {
    this.faults.set(method, spec);
  }

  clear(method?: ServerPortMethod): void {
    if (method) this.faults.delete(method);
    else this.faults.clear();
  }

  get(method: ServerPortMethod): FaultSpec | undefined {
    return this.faults.get(method);
  }
}

export async function applyFault<T>(
  registry: FaultRegistry,
  method: ServerPortMethod,
  action: () => T | Promise<T>
): Promise<T> {
  const fault = registry.get(method);
  if (!fault) return action();
  if (fault.mode === "throw") {
    throw new Error(fault.message ?? `injected fault: ${method}`);
  }
  return returnErrorFor(method, fault.message) as T;
}

function returnErrorFor(method: ServerPortMethod, message = "injected fault"): unknown {
  switch (method) {
    case "network.probe":
      return { reachable: false, error: message };
    case "docker.imageExists":
    case "assets.isInstallationComplete":
    case "fs.exists":
      return false;
    case "fs.ensureDir":
    case "assets.materialize":
    case "docker.pullImage":
    case "docker.run":
    case "process.spawn":
    case "process.kill":
    case "docker.stop":
      throw new Error(message);
    default:
      throw new Error(`return-error not defined for ${method}`);
  }
}

export function assertActorNotStuck(state: string): void {
  if (state === "FatalErrorState") {
    throw new Error("MmkitServerActor entered FatalErrorState");
  }
}
