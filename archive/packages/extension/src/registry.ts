import type * as ihsm from "ihsm";
import { otelToIhsmTraceLevel } from "./logging/trace-level";
import { MmkitLogHub, MmkitTraceWriter } from "./logging/trace";
import type { OtelTraceLevel } from "./types";

export const ACTOR_IDS = {
  supervisor: "extension.supervisor",
  config: "config",
  server: "server.manager",
  client: "client.manager",
  languageServer: "language.server",
  panel: "panel.interaction",
} as const;

export type ActorId = (typeof ACTOR_IDS)[keyof typeof ACTOR_IDS];

type AnyHsm = ihsm.Hsm<unknown, Record<string, unknown>>;

export class ActorRegistry {
  private readonly actors = new Map<string, AnyHsm>();

  constructor(private readonly logHub?: MmkitLogHub) {}

  actorTrace(actorId: string): MmkitTraceWriter {
    return this.logHub?.forActor(actorId) ?? new MmkitTraceWriter(actorId);
  }

  register(id: string, hsm: AnyHsm): void {
    this.actors.set(id, hsm);
  }

  get(id: string): AnyHsm | undefined {
    return this.actors.get(id);
  }

  post(id: string, event: string, ...payload: unknown[]): void {
    const hsm = this.actors.get(id);
    if (!hsm) return;
    (hsm.post as (name: string, ...args: unknown[]) => void)(event, ...payload);
  }

  postFrom(fromActor: string, toActor: string, event: string, ...payload: unknown[]): void {
    this.logHub?.logPost(fromActor, toActor, event, payload);
    this.post(toActor, event, ...payload);
  }

  async sync(id: string): Promise<void> {
    await this.actors.get(id)?.sync();
  }

  async syncAll(): Promise<void> {
    await Promise.all([...this.actors.values()].map((hsm) => hsm.sync()));
  }

  applyTraceLevel(level: OtelTraceLevel): void {
    this.logHub?.setMinLevel(level);
    const ihsmLevel = otelToIhsmTraceLevel(level);
    for (const hsm of this.actors.values()) {
      hsm.traceLevel = ihsmLevel;
    }
  }

  clear(): void {
    this.actors.clear();
  }

  ids(): string[] {
    return [...this.actors.keys()];
  }
}
