import type { CbConnectParams } from "../cb-session";
import {
  optionalPort,
  optionalString,
  requireAskFormat,
  requireIdentifier,
  requireString,
  requireStringArray,
} from "../validation/validate-args";
import { requireValidFramePair, requireValidFrames } from "../validation/validate-frames";
import { MCPTool } from "./cb-tool";

const label = (a: Record<string, unknown>) => optionalString(a, "answerRep", 32) ?? "LABEL";
const now = (a: Record<string, unknown>) => optionalString(a, "rollbackTime", 64) ?? "Now";

// Each tool = MCP metadata + a plain `exec(ctx, raw)` routine, registered via
// `MCPTool(meta, exec)`. Registration order = call order in this file. No list
// or class to maintain — add another `MCPTool(...)` below.

// ── lifecycle / status ─────────────────────────────────────────────────────────

MCPTool(
  {
    name: "mmkit_server_status",
    title: "mmkit server status",
    description:
      "Returns mmkit server lifecycle phase (idle|starting|running|…) and TCP port. Call before cb_connect when using internal server.",
  },
  async (ctx) => ctx.supervisor.getState(),
);

MCPTool(
  {
    name: "cb_connect",
    title: "Connect to ConceptBase server",
    description:
      "Enrolls an MCP session over TCP (ICBclient.enrollMe). Optional host/port override; default uses running mmkit server on 127.0.0.1.",
  },
  async (ctx, raw) => {
    const params: CbConnectParams = {
      host: optionalString(raw, "host", 253),
      port: optionalPort(raw, "port"),
      toolName: optionalString(raw, "toolName", 128),
      userName: optionalString(raw, "userName", 128),
    };
    const client = await ctx.session.getClient(params);
    return { ok: true, host: client.host, port: client.port, clientId: client.clientName, serverId: client.serverName };
  },
);

MCPTool(
  { name: "cb_disconnect", title: "Disconnect from ConceptBase server", description: "CANCEL_ME / disconnect current MCP session." },
  async (ctx) => {
    await ctx.session.disconnect();
    return { ok: true };
  },
);

// ── tell / untell ────────────────────────────────────────────────────────────

MCPTool(
  { name: "cb_tell", title: "Tell frames", description: "TELL frames — tree-sitter validated ConceptBase source." },
  async (ctx, raw) => (await ctx.client()).tell(await requireValidFrames(raw, "frames")),
);

MCPTool(
  { name: "cb_untell", title: "Untell frames", description: "UNTELL frames — tree-sitter validated." },
  async (ctx, raw) => (await ctx.client()).untell(await requireValidFrames(raw, "frames")),
);

MCPTool(
  { name: "cb_tell_transactions", title: "Tell transactions", description: "Tell {---} transaction blocks." },
  async (ctx, raw) => (await ctx.client()).tellTransactions(requireString(raw, "transactions")),
);

MCPTool(
  { name: "cb_tell_model", title: "Tell model", description: "Tell remote model file paths on server." },
  async (ctx, raw) => (await ctx.client()).tellModel(requireStringArray(raw, "files")),
);

MCPTool(
  { name: "cb_retell", title: "Retell frames", description: "RETELL in one transaction." },
  async (ctx, raw) => {
    const { untellFrames, tellFrames } = await requireValidFramePair(raw, "untellFrames", "tellFrames");
    return (await ctx.client()).retell(untellFrames, tellFrames);
  },
);

// ── ask variants ───────────────────────────────────────────────────────────────

MCPTool(
  { name: "cb_ask", title: "Ask query", description: "ASK query (ICBclient.ask)." },
  async (ctx, raw) => {
    const queryFormat = requireAskFormat(optionalString(raw, "queryFormat", 32) ?? "OBJNAMES", "queryFormat");
    return (await ctx.client()).ask(requireString(raw, "query"), queryFormat, label(raw), now(raw));
  },
);

MCPTool(
  { name: "cb_ask_frames", title: "Ask frames", description: "ASK with FRAMES query format." },
  async (ctx, raw) => (await ctx.client()).askFrames(requireString(raw, "query"), label(raw), now(raw)),
);

MCPTool(
  { name: "cb_ask_objnames", title: "Ask object names", description: "ASK with OBJNAMES query format." },
  async (ctx, raw) => (await ctx.client()).askObjNames(requireString(raw, "query"), label(raw), now(raw)),
);

MCPTool(
  { name: "cb_hypo_ask", title: "Hypothetical ask", description: "Hypothetical ASK with temporary frames." },
  async (ctx, raw) => {
    const frames = await requireValidFrames(raw, "frames");
    const queryFormat = requireAskFormat(requireString(raw, "queryFormat", { maxLength: 32 }), "queryFormat");
    return (await ctx.client()).hypoAsk(frames, requireString(raw, "query"), queryFormat, label(raw), now(raw));
  },
);

// ── object builtins ──────────────────────────────────────────────────────────

MCPTool(
  { name: "cb_get_object", title: "Get object", description: "Builtin get_object[objname]." },
  async (ctx, raw) => {
    const objname = requireIdentifier(requireString(raw, "objname", { maxLength: 512 }), "objname");
    return { completion: "ok", ok: true, result: await (await ctx.client()).getObject(objname) };
  },
);

MCPTool(
  { name: "cb_find_instances", title: "Find instances", description: "Builtin find_instances[class]." },
  async (ctx, raw) => {
    const objname = requireIdentifier(requireString(raw, "objname", { maxLength: 512 }), "objname");
    return { completion: "ok", ok: true, result: await (await ctx.client()).findInstances(objname) };
  },
);

// ── LPI / messaging ────────────────────────────────────────────────────────────

MCPTool(
  { name: "cb_lpi_call", title: "LPI call", description: "LPI Prolog call." },
  async (ctx, raw) => (await ctx.client()).lpiCall(requireString(raw, "lpicall")),
);

MCPTool(
  { name: "cb_next_message", title: "Next message", description: "Poll server message queue." },
  async (ctx, raw) => (await ctx.client()).nextMessage(requireString(raw, "messageType", { maxLength: 128 })),
);

// ── module navigation ──────────────────────────────────────────────────────────

MCPTool(
  { name: "cb_set_module", title: "Set module", description: "SET_MODULE_CONTEXT." },
  async (ctx, raw) => (await ctx.client()).setModule(requireString(raw, "module", { maxLength: 1024 })),
);

MCPTool(
  { name: "cb_get_module", title: "Get module", description: "GET_MODULE_CONTEXT." },
  async (ctx) => ({ completion: "ok", ok: true, result: await (await ctx.client()).getModule() }),
);

MCPTool(
  { name: "cb_get_module_path", title: "Get module path", description: "GET_MODULE_PATH." },
  async (ctx) => (await ctx.client()).getModulePath(),
);

MCPTool(
  { name: "cb_list_module", title: "List module", description: "listModule[module/module] ASK." },
  async (ctx, raw) => {
    const module = requireString(raw, "module", { maxLength: 512 });
    return { completion: "ok", ok: true, result: await (await ctx.client()).listModule(module) };
  },
);

// ── server control ─────────────────────────────────────────────────────────────

MCPTool(
  { name: "cb_notification_request", title: "Notification request", description: "NOTIFICATION_REQUEST." },
  async (ctx, raw) => (await ctx.client()).notificationRequest(requireString(raw, "about"), optionalString(raw, "tool", 128)),
);

MCPTool(
  { name: "cb_stop_server", title: "Stop server", description: "STOP_SERVER on connected cbserver." },
  async (ctx) => (await ctx.client()).stopServer(),
);

// ── simplified helpers ──────────────────────────────────────────────────────────

MCPTool(
  { name: "cb_tells", title: "Tells (simplified)", description: "Simplified tell → yes/no." },
  async (ctx, raw) => ({ result: await (await ctx.client()).tells(await requireValidFrames(raw, "frames")) }),
);

MCPTool(
  { name: "cb_untells", title: "Untells (simplified)", description: "Simplified untell → yes/no." },
  async (ctx, raw) => ({ result: await (await ctx.client()).untells(await requireValidFrames(raw, "frames")) }),
);

MCPTool(
  { name: "cb_asks", title: "Asks (simplified)", description: "Simplified ask → string answer." },
  async (ctx, raw) => ({ result: await (await ctx.client()).asks(requireString(raw, "query"), optionalString(raw, "format", 32)) }),
);

MCPTool(
  { name: "cb_pwd", title: "Print working module", description: "Module path string." },
  async (ctx) => ({ result: await (await ctx.client()).pwd() }),
);

MCPTool(
  { name: "cb_cd", title: "Change module", description: "Change module context." },
  async (ctx, raw) => ({ result: await (await ctx.client()).cd(requireString(raw, "module", { maxLength: 1024 })) }),
);

MCPTool(
  { name: "cb_mkdir", title: "Make submodule", description: "Create submodule in current module." },
  async (ctx, raw) => ({ result: await (await ctx.client()).mkdir(requireString(raw, "module", { maxLength: 512 })) }),
);
