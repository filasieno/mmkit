import * as ihsm from "ihsm";
import { encodeCbString } from "../protocol/cb-tcp";
import { makeMmkitHsm } from "../logging/hsm-factory";
import type { MmkitTraceWriter } from "../logging/trace";
import type { ActorRegistry } from "../registry";
import { ACTOR_IDS } from "../registry";
import type { MmkitPorts } from "../ports/types";
import type { ConfigSnapshot, OtelTraceLevel } from "../types";

export interface ClientManagerCtx {
  ports: MmkitPorts;
  registry: ActorRegistry;
  trace: MmkitTraceWriter;
  snapshot?: ConfigSnapshot;
  enabled: boolean;
  socketId?: string;
  clientName: string;
  serverName: string;
  shutdownRequested: boolean;
  disableAfterStop: boolean;
}

export interface ClientManagerProtocol {
  enable(snapshot: ConfigSnapshot): void;
  disable(): void;
  userConnect(): void;
  userDisconnect(): void;
  snapshotUpdated(snapshot: ConfigSnapshot): void;
  connectFailed(error: string): void;
  enrollOk(): void;
  enrollFailed(error: string): void;
  connectionLost(): void;
  shutdownRequested(): void;
  shutdownForce(): void;
  beginConnect(): void;
  beginDisconnect(): void;
  traceLevelChanged(level: OtelTraceLevel): void;
}

export class ClientTop extends ihsm.TopState<ClientManagerCtx, ClientManagerProtocol> {
  traceLevelChanged(level: OtelTraceLevel): void {
    this.ctx.trace.info("trace level changed", { level, state: this.hsm.currentStateName });
  }

  protected reportIdle(): void {
    this.ctx.registry.postFrom(ACTOR_IDS.client, ACTOR_IDS.supervisor, "managerReportIdle", ACTOR_IDS.client);
  }

  protected reportFault(message: string): void {
    this.ctx.trace.warn(message, { state: this.hsm.currentStateName, event: this.hsm.eventName });
    this.ctx.registry.postFrom(ACTOR_IDS.client, ACTOR_IDS.supervisor, "managerReportFault", {
      actorId: ACTOR_IDS.client,
      message,
    });
  }

  protected debug(message: string, detail?: unknown): void {
    this.ctx.trace.debug(this.hsm, message, detail);
  }

  snapshotUpdated(snapshot: ConfigSnapshot): void {
    this.ctx.snapshot = snapshot;
  }

  shutdownForce(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }

  /** Idempotent — duplicate posts from enable/auto-connect or user command while already connecting/connected. */
  userConnect(): void {}

  /** Shared teardown — must live on ClientTop because ihsm runs onEntry before the leaf prototype swap. */
  protected async tearDownClient(): Promise<void> {
    this.debug("tearing down TCP client", { socketId: this.ctx.socketId, shutdownRequested: this.ctx.shutdownRequested });
    if (this.ctx.socketId) {
      try {
        const result = await this.ctx.ports.tcp.disconnect(this.ctx.socketId, this.ctx.clientName, this.ctx.serverName);
        if (!result.ok) {
          this.reportFault(result.error ?? "disconnect failed");
        }
      } catch (err) {
        this.debug("tcp disconnect failed during teardown", { error: String(err) });
        this.reportFault(String(err));
      }
      this.ctx.socketId = undefined;
    }
    if (this.ctx.shutdownRequested) {
      if (this.hsm.currentStateName !== "ShuttingDown") {
        this.transition(ShuttingDown);
      }
      return;
    }
    if (this.ctx.disableAfterStop) {
      this.ctx.disableAfterStop = false;
      this.transition(Disabled);
      return;
    }
    this.transition(Idle);
  }
}

@ihsm.InitialState
export class Disabled extends ClientTop {
  onEntry(): void {
    this.reportIdle();
  }

  disable(): void {
    this.reportIdle();
  }

  enable(snapshot: ConfigSnapshot): void {
    this.ctx.enabled = true;
    this.ctx.snapshot = snapshot;
    if (snapshot.client.autoConnect) {
      if (!snapshot.valid) {
        this.reportFault("Cannot auto-connect: invalid configuration");
        this.transition(Idle);
        return;
      }
      this.transition(Connecting);
      return;
    }
    this.transition(Idle);
  }

  shutdownRequested(): void {
    this.ctx.registry.postFrom(ACTOR_IDS.client, ACTOR_IDS.supervisor, "childShutdownAck", ACTOR_IDS.client);
  }

  shutdownForce(): void {
    this.shutdownRequested();
  }
}

/** Connected or connecting — tear down via Disconnecting. */
export class ClientOperational extends ClientTop {
  userDisconnect(): void {
    this.transition(Disconnecting);
  }

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(Disconnecting);
  }

  disable(): void {
    this.ctx.disableAfterStop = true;
    this.transition(Disconnecting);
  }
}

export class Idle extends ClientTop {
  onEntry(): void {
    if (!this.ctx.disableAfterStop) {
      this.reportIdle();
    }
  }

  disable(): void {
    this.transition(Disabled);
  }

  userConnect(): void {
    if (!this.ctx.snapshot?.valid) {
      this.reportFault("Cannot connect: invalid configuration");
      return;
    }
    this.transition(Connecting);
  }

  userDisconnect(): void {}

  shutdownRequested(): void {
    this.ctx.shutdownRequested = true;
    this.transition(ShuttingDown);
  }
}

export class Connecting extends ClientOperational {
  onEntry(): void {
    this.postNow("beginConnect");
  }

  async beginConnect(): Promise<void> {
    const snapshot = this.ctx.snapshot;
    if (!snapshot) {
      this.transition(Idle);
      return;
    }
    try {
      const { host, port, toolName, userName, connectTimeoutMs } = snapshot.client;
      const result = await this.ctx.ports.tcp.connect(host, port, connectTimeoutMs);
      if (!result.ok || !result.socketId) {
        this.postNow("connectFailed", result.error ?? "connect failed");
        return;
      }
      this.ctx.socketId = result.socketId;
      const enroll = await this.ctx.ports.tcp.enroll(result.socketId, toolName, userName);
      if (!enroll.ok || enroll.completion !== "ok") {
        await this.ctx.ports.tcp.close(result.socketId);
        this.ctx.socketId = undefined;
        this.postNow("enrollFailed", enroll.error ?? "ENROLL_ME failed");
        return;
      }
      this.ctx.serverName = enroll.sender ?? '"cbserver"';
      this.ctx.clientName = encodeCbString(enroll.returnData ?? toolName);
      this.postNow("enrollOk");
    } catch (err) {
      this.postNow("connectFailed", String(err));
    }
  }

  enrollOk(): void {
    this.debug("ENROLL_ME ok", { serverName: this.ctx.serverName, clientName: this.ctx.clientName });
    this.transition(Connected);
  }

  connectFailed(error: string): void {
    this.failConnect(error);
  }

  enrollFailed(error: string): void {
    this.failConnect(error);
  }

  private failConnect(error: string): void {
    this.reportFault(error);
    this.transition(Idle);
  }
}

export class Connected extends ClientOperational {
  connectionLost(): void {
    this.reportFault("TCP connection lost");
    this.ctx.socketId = undefined;
    if (this.ctx.snapshot?.client.autoReconnect) {
      this.transition(Connecting);
      return;
    }
    this.transition(Idle);
  }
}

export class Disconnecting extends ClientTop {
  onEntry(): void {
    this.postNow("beginDisconnect");
  }

  async beginDisconnect(): Promise<void> {
    await this.tearDownClient();
  }

  /** Watchdog may fire while async teardown is in flight — avoid a duplicate transition. */
  shutdownForce(): void {
    this.ctx.shutdownRequested = true;
  }
}

export class ShuttingDown extends ClientTop {
  onEntry(): void {
    this.ctx.enabled = false;
    this.ctx.registry.postFrom(ACTOR_IDS.client, ACTOR_IDS.supervisor, "childShutdownAck", ACTOR_IDS.client);
  }

  shutdownRequested(): void {}

  shutdownForce(): void {}
}

ihsm.registerStateNames({
  Disabled,
  ClientOperational,
  Idle,
  Connecting,
  Connected,
  Disconnecting,
  ShuttingDown,
});

export function createClientManager(ctx: ClientManagerCtx): ihsm.Hsm<ClientManagerCtx, ClientManagerProtocol> {
  return makeMmkitHsm(ClientTop, ctx);
}
