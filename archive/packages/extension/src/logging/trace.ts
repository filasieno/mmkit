import type * as vscode from "vscode";
import * as ihsm from "ihsm";
import type { OtelTraceLevel } from "../types";
import { otelToIhsmTraceLevel, shouldEmitLog } from "./trace-level";

export type LogSeverity = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const TRACE_CHANNEL_NAME = "MMKit Trace";

export interface StructuredLog {
  ts: string;
  severity: LogSeverity;
  actorId?: string;
  state?: string;
  event?: string;
  message: string;
  detail?: unknown;
}

const TRANSITION_RE = /transition from (\S+) to (\S+)/i;
const EVENT_BEGIN_RE = /begin event dispatch of #(\S+)/i;
const EVENT_START_RE = /#(\S+)\|/;

let globalOtelTraceLevel: OtelTraceLevel = "trace";

/** ihsm trace verbosity from configured OTEL level (MMKIT_VERBOSE_HSM=1 forces VERBOSE_DEBUG). */
export function mmkitTraceLevel(): ihsm.TraceLevel {
  if (typeof process !== "undefined" && process.env.MMKIT_VERBOSE_HSM === "1") {
    return ihsm.TraceLevel.VERBOSE_DEBUG;
  }
  return otelToIhsmTraceLevel(globalOtelTraceLevel);
}

export function setGlobalOtelTraceLevel(level: OtelTraceLevel): void {
  globalOtelTraceLevel = level;
}

export function getGlobalOtelTraceLevel(): OtelTraceLevel {
  return globalOtelTraceLevel;
}

export class MmkitTraceWriter implements ihsm.TraceWriter {
  constructor(
    private readonly actorId: string,
    private readonly channel?: vscode.OutputChannel,
    private minLevel: OtelTraceLevel = globalOtelTraceLevel
  ) {}

  setMinLevel(level: OtelTraceLevel): void {
    this.minLevel = level;
  }

  write<Context, Protocol extends {} | undefined>(hsm: ihsm.Properties<Context, Protocol>, msg: unknown): void {
    const text = typeof msg === "string" ? msg : stringifyDetail(msg);
    const severity = classifyIhsmMessage(text);
    const event = resolveEvent(hsm, text);
    const transition = parseTransition(text);

    const entry: StructuredLog = {
      ts: new Date().toISOString(),
      severity,
      actorId: this.actorId,
      state: hsm.currentStateName,
      event,
      message: transition ? `transition ${transition.from} → ${transition.to}` : summarizeTraceMessage(text),
      detail: transition ? undefined : text !== summarizeTraceMessage(text) ? text : undefined,
    };
    this.emit(entry);
  }

  log(severity: LogSeverity, message: string, detail?: unknown): void {
    const entry: StructuredLog = {
      ts: new Date().toISOString(),
      severity,
      actorId: this.actorId,
      message,
      detail,
    };
    this.emit(entry);
  }

  /** Structured debug line from a state handler (includes current event when inside dispatch). */
  debug<Context, Protocol extends {} | undefined>(
    hsm: ihsm.Properties<Context, Protocol>,
    message: string,
    detail?: unknown
  ): void {
    const entry: StructuredLog = {
      ts: new Date().toISOString(),
      severity: "debug",
      actorId: this.actorId,
      state: hsm.currentStateName,
      event: hsm.eventName || undefined,
      message,
      detail: detail ?? (hsm.eventPayload?.length ? { payload: summarizePayload(hsm.eventPayload) } : undefined),
    };
    this.emit(entry);
  }

  info(message: string, detail?: unknown): void {
    this.log("info", message, detail);
  }

  warn(message: string, detail?: unknown): void {
    this.log("warn", message, detail);
  }

  error(message: string, detail?: unknown): void {
    this.log("error", message, detail);
  }

  private emit(entry: StructuredLog): void {
    if (!shouldEmitLog(this.minLevel, entry.severity)) return;
    const sev = entry.severity.toUpperCase().padEnd(5, " ");
    const actor = `[${entry.actorId ?? "mmkit"}]`;
    const state = entry.state ? `${entry.state}` : "";
    const event = entry.event ? `#${entry.event}` : "";
    const loc = [state, event].filter(Boolean).join(".");
    const suffix = entry.detail !== undefined ? ` ${stringifyDetail(entry.detail)}` : "";
    const text = `${entry.ts} ${sev} ${actor}${loc ? ` ${loc}:` : ":"} ${entry.message}${suffix}`;
    this.channel?.appendLine(text);
  }
}

/** Routes trace writers per actor and logs cross-actor posts. */
export class MmkitLogHub {
  private readonly writers = new Map<string, MmkitTraceWriter>();
  private minLevel: OtelTraceLevel = globalOtelTraceLevel;

  constructor(private readonly channel?: vscode.OutputChannel) {}

  setMinLevel(level: OtelTraceLevel): void {
    this.minLevel = level;
    setGlobalOtelTraceLevel(level);
    for (const writer of this.writers.values()) {
      writer.setMinLevel(level);
    }
  }

  getMinLevel(): OtelTraceLevel {
    return this.minLevel;
  }

  forActor(actorId: string): MmkitTraceWriter {
    let writer = this.writers.get(actorId);
    if (!writer) {
      writer = new MmkitTraceWriter(actorId, this.channel, this.minLevel);
      this.writers.set(actorId, writer);
    }
    return writer;
  }

  logPost(fromActor: string, toActor: string, event: string, payload: unknown[]): void {
    const writer = this.forActor(fromActor);
    writer.log("debug", `post → ${toActor}`, { event, payload: summarizePayload(payload) });
  }
}

export function createMmkitDispatchErrorHandler(
  trace: MmkitTraceWriter
): ihsm.DispatchErrorCallback<unknown, Record<string, unknown>> {
  return (hsm, error) => {
    const eventName = hsm.eventName;
    const cause = (error as { cause?: { eventName?: string; stateName?: string } }).cause;
    trace.error(`dispatch failed: ${error.message}`, {
      state: hsm.currentStateName,
      event: eventName || cause?.eventName,
      cause: cause?.stateName,
    });
    trace.write(hsm, `An event dispatch has failed; error ${error.name}: ${error.message} has not been managed`);
    trace.write(hsm, error);
    throw error;
  };
}

export function createOutputChannel(vscodeApi: typeof vscode): vscode.OutputChannel {
  return vscodeApi.window.createOutputChannel(TRACE_CHANNEL_NAME);
}

export { TRACE_CHANNEL_NAME };

function classifyIhsmMessage(text: string): LogSeverity {
  const lower = text.toLowerCase();
  if (lower.includes("failure:") || lower.includes("failed")) return "error";
  if (lower.includes("unhandled")) return "warn";
  if (TRANSITION_RE.test(text) || lower.includes("final state is")) return "info";
  if (lower.includes("begin event dispatch") || lower.includes("event dispatch successful")) return "debug";
  if (lower.includes("started event handler") || lower.includes("handler execution")) return "debug";
  if (lower.includes("initialization") || lower.includes("begin ") || lower.includes("end ")) return "trace";
  return "trace";
}

function parseTransition(text: string): { from: string; to: string } | undefined {
  const match = text.match(TRANSITION_RE);
  if (!match) return undefined;
  return { from: match[1]!, to: match[2]! };
}

function resolveEvent<Context, Protocol extends {} | undefined>(
  hsm: ihsm.Properties<Context, Protocol>,
  text: string
): string | undefined {
  if (hsm.eventName) return hsm.eventName;
  const begin = text.match(EVENT_BEGIN_RE);
  if (begin) return begin[1];
  const stack = text.match(EVENT_START_RE);
  if (stack) return stack[1];
  return undefined;
}

function summarizeTraceMessage(text: string): string {
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}…`;
}

function summarizePayload(payload: unknown[]): unknown {
  if (payload.length === 0) return undefined;
  if (payload.length === 1) return sanitizePayloadValue(payload[0]);
  return payload.map(sanitizePayloadValue);
}

function sanitizePayloadValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object" && value !== null && "valid" in value && "generation" in value) {
    const snap = value as { generation: number; valid: boolean; operationalMode?: string };
    return { snapshot: { generation: snap.generation, valid: snap.valid, mode: snap.operationalMode } };
  }
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > 200 ? `${json.slice(0, 197)}…` : JSON.parse(json);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function stringifyDetail(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
