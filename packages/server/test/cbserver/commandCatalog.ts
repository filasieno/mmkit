/**
 * Real-cbserver command sequences aligned with the programming manual:
 * `components/doc/prog-manual/chapters/Server-Interface.typ` and `IpcSyntax.typ`.
 *
 * Ordering:
 * 1. ENROLL_ME (implicit on connect)
 * 2. Module context: GET_MODULE_PATH, SET_MODULE_CONTEXT, GET_MODULE_CONTEXT
 * 3. TELL_MODEL — load schema from files the server can read
 * 4. TELL — instances and query objects in the current module
 * 5. ASK — Format is `FRAMES` or `OBJNAMES` only; AnswerRep is LABEL / FRAME / …
 * 6. HYPO_ASK — temporary frames, then ASK with the same format rules
 * 7. RETELL / UNTELL
 * 8. REPORT_CLIENTS, NOTIFICATION_REQUEST (extension), NEXT_MESSAGE, LPI_CALL
 * 9. CANCEL_ME (implicit on connection.close in withRealSession)
 *
 * Reference clients (oracle order):
 * 1. Java `LocalCBclient` / `CBConnection` (`javaOracle.ts`)
 * 2. `Server-Interface.typ`, `IpcSyntax.typ`
 * 3. `cb_client_demo.pl`, C/C++ testlib
 */
import * as fs from "node:fs/promises";
import { expect } from "chai";
import { CB_IPC_METHODS, type CBIpcMethod } from "../../src/cbserver/shared/cbIpcCatalog";
import type { CBAnswer, ICBConnection } from "../../src/cbserver/shared/CBServerDefs";
import {
  javaDeleteNotificationAbout,
  javaPrologLpiGoal,
  javaViewNotificationAbout,
  JAVA_ORACLE,
} from "./javaOracle";
import { MS, runTimed, type RunningServer } from "./realHarness";

export type RunCommand = (
  server: RunningServer,
  connection: ICBConnection,
  label: string,
  work: () => Promise<CBAnswer>,
) => Promise<CBAnswer>;

/** API methods documented in Server-Interface.typ (+ libcbc helpers). */
export const SERVER_INTERFACE_API_METHODS = [
  "getConnectionId",
  "getClientId",
  "getNotificationClientId",
  "tell",
  "untell",
  "retell",
  "tellModel",
  "ask",
  "hypoAsk",
  "lpicall",
  "prolog",
  "why",
  "cd",
  "pwd",
  "lm",
  "ls",
  "mkdir",
  "who",
  "sub",
  "show",
  "nextMessage",
  "reportClients",
] as const;

/** CInterface.typ extensions (dual-socket notification channel). */
export const CINTERFACE_EXTENSION_API_METHODS = [
  "notificationRequest",
  "getNotificationMessage",
] as const;

export const ICB_CONNECTION_API_METHODS = [
  ...SERVER_INTERFACE_API_METHODS,
  ...CINTERFACE_EXTENSION_API_METHODS,
] as const;

export type ICBConnectionApiMethod = (typeof ICB_CONNECTION_API_METHODS)[number];

export type RealCommandFixtures = {
  mod: string;
  smlBase: string;
  smlModel: string;
  framesBill: string;
  framesBillName: string;
  framesMary: string;
  framesQuery: string;
  hypoFrameQuery: string;
  notifyClass: string;
  framesEmpView: string;
  /** Assign NaiveVM so init_view_maintenance skips VM rule generation (server default is bottomUpVM). */
  framesEmpViewNaiveVm: string;
};

export function makeRealCommandFixtures(): RealCommandFixtures {
  const mod = `MmkitCmd${Date.now()}`;
  const smlBase = `/tmp/mmkit-${mod}`;
  const smlModel = [
    "Employee in Class with",
    "  attribute",
    "    empno: Integer;",
    "    name: String;",
    "    salary: Integer",
    "end",
  ].join("\n");
  return {
    mod,
    smlBase,
    smlModel,
    notifyClass: "Employee",
    framesEmpView:
      "View EmpView isA Employee with constraint c: $ exists i/Integer (this salary i) and (i > 10000) $ end",
    framesEmpViewNaiveVm: "EmpView in NaiveVM end",
    framesBill: "bill in Employee with empno billsempno: 123 salary billsalary: 50000 end",
    framesBillName: 'bill in Employee with name billsname: "William" end',
    framesMary: "mary in Employee end",
    framesQuery:
      "UnnamedEmployee in QueryClass isA Employee with"
      + " constraint c: $ not exists n/String (this name n) $ end",
    hypoFrameQuery:
      "HypoUnnamed in QueryClass isA Employee with"
      + " constraint c: $ not exists n/String (this name n) $ end",
  };
}

export type RealCommandStep = {
  label: string;
  coversIpc: CBIpcMethod[];
  coversApi: ICBConnectionApiMethod[];
  run(
    run: RunCommand,
    server: RunningServer,
    connection: ICBConnection,
    fixtures: RealCommandFixtures,
    ctx: { notifClientId: string },
  ): Promise<void>;
};

export function allIpcMethodsExceptStop(): CBIpcMethod[] {
  return Object.values(CB_IPC_METHODS).filter((m) => m !== CB_IPC_METHODS.STOP_SERVER);
}

export function buildRealCommandSteps(): RealCommandStep[] {
  return [
    // --- session identity (post ENROLL_ME) ---
    {
      label: "getConnectionId",
      coversIpc: [],
      coversApi: ["getConnectionId"],
      async run(_run, _server, connection) {
        const id = await runTimed("getConnectionId", () => connection.getConnectionId(), MS.identity);
        expect(id).to.match(/^conn-\d+$/);
      },
    },
    {
      label: "getClientId",
      coversIpc: [],
      coversApi: ["getClientId"],
      async run(_run, _server, connection, _fixtures, ctx) {
        ctx.notifClientId = await runTimed(
          "getNotificationClientId",
          () => connection.getNotificationClientId(),
          MS.identity,
        );
        const cmdId = await runTimed("getClientId", () => connection.getClientId(), MS.identity);
        expect(cmdId).to.be.a("string").with.length.greaterThan(0);
        expect(ctx.notifClientId).to.be.a("string").with.length.greaterThan(0);
        expect(ctx.notifClientId).to.not.equal(cmdId);
      },
    },
    {
      label: "getNotificationClientId",
      coversIpc: [],
      coversApi: ["getNotificationClientId"],
      async run(_run, _server, connection, _fixtures, ctx) {
        expect(
          await runTimed("getNotificationClientId-repeat", () => connection.getNotificationClientId(), MS.identity),
        ).to.equal(ctx.notifClientId);
      },
    },

    // --- module context (Server-Interface § GET/SET module) ---
    {
      label: "pwd-initial",
      coversIpc: [CB_IPC_METHODS.GET_MODULE_PATH],
      coversApi: ["pwd"],
      async run(run, server, connection) {
        await run(server, connection, "pwd-initial", () => connection.pwd());
      },
    },
    {
      label: "mkdir",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["mkdir"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "mkdir", () => connection.mkdir(fixtures.mod));
      },
    },
    {
      label: "cd-set",
      coversIpc: [CB_IPC_METHODS.SET_MODULE_CONTEXT],
      coversApi: ["cd"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "cd", () => connection.cd(fixtures.mod));
      },
    },
    {
      label: "pwd-after-cd",
      coversIpc: [CB_IPC_METHODS.GET_MODULE_PATH],
      coversApi: ["pwd"],
      async run(run, server, connection) {
        await run(server, connection, "pwd-after-cd", () => connection.pwd());
      },
    },
    {
      label: "get-module-context",
      coversIpc: [CB_IPC_METHODS.GET_MODULE_CONTEXT],
      coversApi: ["cd"],
      async run(run, server, connection) {
        await run(server, connection, "get-module-context", () => connection.cd());
      },
    },

    // --- TELL_MODEL then TELL (manual § TELL_MODEL, § TELL) ---
    {
      label: "tellModel",
      coversIpc: [CB_IPC_METHODS.TELL_MODEL],
      coversApi: ["tellModel"],
      async run(run, server, connection, fixtures) {
        await runTimed(
          "write-sml-model",
          () => fs.writeFile(`${fixtures.smlBase}.sml`, `${fixtures.smlModel}\n`, "utf8"),
          MS.step,
        );
        await run(server, connection, "tellModel", () => connection.tellModel(fixtures.smlBase));
      },
    },
    {
      label: "tell-bill",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["tell"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "tell-bill", () => connection.tell(fixtures.framesBill));
      },
    },
    {
      label: "tell-bill-name",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["tell"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "tell-bill-name", () => connection.tell(fixtures.framesBillName));
      },
    },
    {
      label: "tell-mary",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["tell"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "tell-mary", () => connection.tell(fixtures.framesMary));
      },
    },
    {
      label: "tell-transactions",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["tell"],
      async run(run, server, connection, fixtures) {
        const combined = `${fixtures.framesBillName}{---}${fixtures.framesQuery}`;
        const answer = await run(server, connection, "tell-transactions", () => connection.tell(combined));
        expect(answer.ok, `tell {---} completion=${answer.completion}`).to.equal(true);
      },
    },
    {
      label: "tell-query",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["tell"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "tell-query", () => connection.tell(fixtures.framesQuery));
      },
    },

    // --- ASK wrappers / listing (libcbc convenience → ASK) ---
    {
      label: "who",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["who"],
      async run(run, server, connection) {
        await run(server, connection, "who", () => connection.who());
      },
    },
    {
      label: "sub",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["sub"],
      async run(run, server, connection) {
        await run(server, connection, "sub", () => connection.sub());
      },
    },
    {
      label: "lm-named",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["lm"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "lm", () => connection.lm(fixtures.mod));
      },
    },
    {
      label: "lm-current",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["lm"],
      async run(run, server, connection) {
        await run(server, connection, "lm-current", () => connection.lm());
      },
    },
    {
      label: "ls-class",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["ls"],
      async run(run, server, connection) {
        await run(server, connection, "ls", () => connection.ls("Employee"));
      },
    },
    {
      label: "ls-all",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["ls"],
      async run(run, server, connection) {
        await run(server, connection, "ls-all", () => connection.ls());
      },
    },

    // --- ASK (manual § ASK: Format FRAMES | OBJNAMES) ---
    {
      label: "ask-exists-bill",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["ask"],
      async run(run, server, connection) {
        const answer = await run(server, connection, "ask-exists-bill", () =>
          connection.ask("exists[bill/objname]", "OBJNAMES", "default", "Now"),
        );
        expect(answer.result).to.equal("yes");
      },
    },
    {
      label: "ask-objnames-label",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["ask"],
      async run(run, server, connection) {
        await run(server, connection, "ask-unnamed", () =>
          connection.ask("UnnamedEmployee", "OBJNAMES", "LABEL", "Now"),
        );
      },
    },
    {
      label: "ask-get-object-frame",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["ask"],
      async run(run, server, connection) {
        await run(server, connection, "ask-get-object", () =>
          connection.ask("get_object[bill/objname]", "OBJNAMES", "FRAME", "Now"),
        );
      },
    },
    {
      label: "ask-frames-query",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["ask"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "ask-frames-query", () =>
          connection.ask(fixtures.framesQuery, "FRAMES", "LABEL", "Now"),
        );
      },
    },
    {
      label: "show",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["show"],
      async run(run, server, connection) {
        await run(server, connection, "show", () => connection.show("bill"));
      },
    },

    // --- HYPO_ASK (manual § HYPO_ASK) ---
    {
      label: "hypoAsk-objnames",
      coversIpc: [CB_IPC_METHODS.HYPO_ASK],
      coversApi: ["hypoAsk"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "hypoAsk", () =>
          connection.hypoAsk(fixtures.framesBill, "UnnamedEmployee", "OBJNAMES", "LABEL", "Now"),
        );
      },
    },
    {
      label: "hypoAsk-frames",
      coversIpc: [CB_IPC_METHODS.HYPO_ASK],
      coversApi: ["hypoAsk"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "hypoAsk-frames", () =>
          connection.hypoAsk(fixtures.framesMary, fixtures.hypoFrameQuery, "FRAMES", "LABEL", "Now"),
        );
      },
    },

    // --- RETELL / UNTELL ---
    {
      label: "retell-mary",
      coversIpc: [CB_IPC_METHODS.RETELL],
      coversApi: ["retell"],
      async run(run, server, connection, fixtures) {
        const retellMary = "mary2 in Employee end";
        await run(server, connection, "retell-mary", () =>
          connection.retell(fixtures.framesMary, retellMary),
        );
      },
    },
    {
      label: "untell-mary2",
      coversIpc: [CB_IPC_METHODS.UNTELL],
      coversApi: ["untell"],
      async run(run, server, connection) {
        await run(server, connection, "untell-mary2", () =>
          connection.untell("mary2 in Employee end"),
        );
      },
    },

    // --- privileged / extensions ---
    {
      label: "reportClients",
      coversIpc: [CB_IPC_METHODS.REPORT_CLIENTS],
      coversApi: ["reportClients"],
      async run(run, server, connection) {
        await run(server, connection, "reportClients", () => connection.reportClients());
      },
    },

    // --- NEXT_MESSAGE (manual § NEXT_MESSAGE: empty → empty_queue) ---
    {
      label: "nextMessage-empty",
      coversIpc: [CB_IPC_METHODS.NEXT_MESSAGE],
      coversApi: ["nextMessage"],
      async run(run, server, connection) {
        const next = await run(server, connection, "nextMessage-empty", () =>
          connection.nextMessage("empty"),
        );
        expect(
          next.result === "empty_queue" || next.completion === "not_handled",
          `nextMessage(empty) result=${next.result} completion=${next.completion}`,
        ).to.equal(true);
      },
    },

    // --- LPI_CALL / prolog / why (Java CBShell + LocalCBclient) ---
    {
      label: "prolog-true",
      coversIpc: [CB_IPC_METHODS.LPI_CALL],
      coversApi: ["prolog"],
      async run(run, server, connection) {
        // CBShell.java: LPIcall("PROLOG_CALL," + goal)
        const answer = await run(server, connection, "prolog-true", () => connection.prolog("true"));
        expect(answer.result).to.equal("true");
      },
    },
    {
      label: "lpicall-getModulePath",
      coversIpc: [CB_IPC_METHODS.LPI_CALL],
      coversApi: ["lpicall"],
      async run(run, server, connection, fixtures) {
        // LocalCBclient.LPIcall sends raw LPI_CALL; PROLOG_CALL wrapper required for goals (CBShell.java)
        const goal = javaPrologLpiGoal("getModulePath(_R)");
        const answer = await run(server, connection, "lpicall-getModulePath", () => connection.lpicall(goal));
        expect(answer.result, `${JAVA_ORACLE.lpiCall} getModulePath in ${fixtures.mod}`).to.include(fixtures.mod);
      },
    },
    {
      label: "why",
      coversIpc: [CB_IPC_METHODS.NEXT_MESSAGE],
      coversApi: ["why"],
      async run(run, server, connection) {
        // LocalCBclient.getErrorMessages → nextMessage("ERROR_REPORT") until empty_queue
        const why = await run(server, connection, "why", () => connection.why());
        expect(
          why.result === "empty_queue" || why.completion === "ok",
          `${JAVA_ORACLE.why} result=${why.result} completion=${why.completion}`,
        ).to.equal(true);
      },
    },
  ];
}

export async function runAllRealCommandSteps(
  run: RunCommand,
  server: RunningServer,
  connection: ICBConnection,
): Promise<{ ipcCovered: Set<CBIpcMethod>; apiCovered: Set<ICBConnectionApiMethod> }> {
  const fixtures = makeRealCommandFixtures();
  const ctx = { notifClientId: "" };
  const ipcCovered = new Set<CBIpcMethod>([CB_IPC_METHODS.ENROLL_ME]);
  const apiCovered = new Set<ICBConnectionApiMethod>();

  for (const step of buildRealCommandSteps()) {
    await step.run(run, server, connection, fixtures, ctx);
    for (const m of step.coversIpc) {
      ipcCovered.add(m);
    }
    for (const m of step.coversApi) {
      apiCovered.add(m);
    }
  }

  ipcCovered.add(CB_IPC_METHODS.CANCEL_ME);
  return { ipcCovered, apiCovered };
}

export type RealCommandBootstrap = "none" | "module" | "schema" | "instances" | "retold";

const BOOTSTRAP_NONE = new Set([
  "getConnectionId",
  "getClientId",
  "getNotificationClientId",
  "pwd-initial",
  "mkdir",
  "reportClients",
  "nextMessage-empty",
  "prolog-true",
  "why",
]);

const BOOTSTRAP_MODULE = new Set([
  "cd-set",
  "pwd-after-cd",
  "get-module-context",
  "lm-named",
  "lm-current",
  "lpicall-getModulePath",
]);

const BOOTSTRAP_SCHEMA = new Set(["tellModel", "who", "sub"]);

const BOOTSTRAP_RETOLD = new Set(["untell-mary2"]);

export function bootstrapLevelForCommandStep(label: string): RealCommandBootstrap {
  if (BOOTSTRAP_NONE.has(label)) {
    return "none";
  }
  if (BOOTSTRAP_MODULE.has(label)) {
    return "module";
  }
  if (BOOTSTRAP_SCHEMA.has(label)) {
    return "schema";
  }
  if (BOOTSTRAP_RETOLD.has(label)) {
    return "retold";
  }
  return "instances";
}

/** Minimal fixture state before an isolated command-step real test. */
export async function bootstrapRealCommandSession(
  run: RunCommand,
  server: RunningServer,
  connection: ICBConnection,
  fixtures: RealCommandFixtures,
  level: RealCommandBootstrap,
): Promise<{ notifClientId: string }> {
  const ctx = { notifClientId: await runTimed("bootstrap-notif-id", () => connection.getNotificationClientId(), MS.identity) };
  if (level === "none") {
    return ctx;
  }
  await run(server, connection, "bootstrap-mkdir", () => connection.mkdir(fixtures.mod));
  await run(server, connection, "bootstrap-cd", () => connection.cd(fixtures.mod));
  if (level === "module") {
    return ctx;
  }
  await runTimed(
    "bootstrap-write-sml",
    () => fs.writeFile(`${fixtures.smlBase}.sml`, `${fixtures.smlModel}\n`, "utf8"),
    MS.step,
  );
  await run(server, connection, "bootstrap-tellModel", () => connection.tellModel(fixtures.smlBase));
  if (level === "schema") {
    return ctx;
  }
  await run(server, connection, "bootstrap-tell-bill", () => connection.tell(fixtures.framesBill));
  await run(server, connection, "bootstrap-tell-bill-name", () => connection.tell(fixtures.framesBillName));
  await run(server, connection, "bootstrap-tell-mary", () => connection.tell(fixtures.framesMary));
  await run(server, connection, "bootstrap-tell-query", () => connection.tell(fixtures.framesQuery));
  if (level === "retold") {
    await run(server, connection, "bootstrap-retell-mary", () =>
      connection.retell(fixtures.framesMary, "mary2 in Employee end"),
    );
  }
  return ctx;
}

export type RealNotificationBootstrap = "none" | "empview" | "registered";

export function bootstrapLevelForNotificationStep(label: string): RealNotificationBootstrap {
  if (label === "tell-empview") {
    return "none";
  }
  // delete + getNotificationMessage need an active subscription already in place
  // when the step runs in isolation (one-by-one runner).
  if (label === "notificationRequest-delete" || label === "getNotificationMessage") {
    return "registered";
  }
  return "empview";
}

export async function bootstrapNotificationSession(
  run: RunCommand,
  server: RunningServer,
  connection: ICBConnection,
  fixtures: RealCommandFixtures,
  level: RealNotificationBootstrap,
): Promise<{ notifClientId: string }> {
  const ctx = { notifClientId: await runTimed("bootstrap-notif-id", () => connection.getNotificationClientId(), MS.identity) };
  await run(server, connection, "bootstrap-mkdir", () => connection.mkdir(fixtures.mod));
  await run(server, connection, "bootstrap-cd", () => connection.cd(fixtures.mod));
  await runTimed(
    "bootstrap-write-sml",
    () => fs.writeFile(`${fixtures.smlBase}.sml`, `${fixtures.smlModel}\n`, "utf8"),
    MS.step,
  );
  await run(server, connection, "bootstrap-tellModel", () => connection.tellModel(fixtures.smlBase));
  await run(server, connection, "bootstrap-tell-bill", () => connection.tell(fixtures.framesBill));
  if (level === "empview" || level === "registered") {
    await run(server, connection, "bootstrap-tell-empview", () => connection.tell(fixtures.framesEmpView));
    await run(server, connection, "bootstrap-tell-empview-naive-vm", () =>
      connection.tell(fixtures.framesEmpViewNaiveVm),
    );
    await run(server, connection, "bootstrap-ask-empview", () =>
      connection.ask("EmpView", "OBJNAMES", "LABEL", "Now"),
    );
  }
  if (level === "registered") {
    await run(server, connection, "bootstrap-notification-request", () =>
      connection.notificationRequest(javaViewNotificationAbout("EmpView"), ctx.notifClientId),
    );
  }
  return ctx;
}

export function assertFullCommandCoverage(
  ipcCovered: Set<CBIpcMethod>,
  apiCovered: Set<ICBConnectionApiMethod>,
): void {
  for (const method of allIpcMethodsExceptStop()) {
    expect(ipcCovered.has(method), `missing IPC coverage: ${method}`).to.equal(true);
  }
  for (const method of ICB_CONNECTION_API_METHODS) {
    expect(apiCovered.has(method), `missing ICBConnection API coverage: ${method}`).to.equal(true);
  }
}

export function buildNotificationCommandSteps(): RealCommandStep[] {
  return [
    {
      label: "tell-empview",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["tell"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "tell-empview", () => connection.tell(fixtures.framesEmpView));
      },
    },
    {
      label: "tell-empview-naive-vm",
      coversIpc: [CB_IPC_METHODS.TELL],
      coversApi: ["tell"],
      async run(run, server, connection, fixtures) {
        await run(server, connection, "tell-empview-naive-vm", () =>
          connection.tell(fixtures.framesEmpViewNaiveVm),
        );
      },
    },
    {
      label: "ask-empview",
      coversIpc: [CB_IPC_METHODS.ASK],
      coversApi: ["ask"],
      async run(run, server, connection) {
        await run(server, connection, "ask-empview", () =>
          connection.ask("EmpView", "OBJNAMES", "LABEL", "Now"),
        );
      },
    },
    {
      label: "notificationRequest",
      coversIpc: [CB_IPC_METHODS.NOTIFICATION_REQUEST],
      coversApi: ["notificationRequest"],
      async run(run, server, connection, _fixtures, ctx) {
        // CBConnection.startNotifyingAbout(issue, notifConn) → notificationRequest(issue, notifConn.getClientId())
        // The command channel targets the *notification* client id (dual-channel parity with Java).
        // Requires the server started with `-v on` (view-maintenance rules); see realHarness.
        const about = javaViewNotificationAbout("EmpView");
        await run(server, connection, "notificationRequest", () =>
          connection.notificationRequest(about, ctx.notifClientId),
        );
      },
    },
    {
      label: "notificationRequest-delete",
      coversIpc: [CB_IPC_METHODS.NOTIFICATION_REQUEST],
      coversApi: ["notificationRequest"],
      async run(run, server, connection, _fixtures, ctx) {
        // CBConnection.stopNotifyingAbout → notificationRequest(delete(view(...))). Retracts the
        // subscription registered in the "registered" bootstrap and returns ok.
        const about = javaDeleteNotificationAbout(javaViewNotificationAbout("EmpView"));
        await run(server, connection, "notificationRequest-delete", () =>
          connection.notificationRequest(about, ctx.notifClientId),
        );
      },
    },
    {
      label: "getNotificationMessage",
      coversIpc: [],
      coversApi: ["getNotificationMessage"],
      async run(_run, _server, connection) {
        // The "registered" bootstrap already issued a NOTIFICATION_REQUEST, so the server
        // pushed the initial view answer onto the notification channel. Pull it here.
        const notifMsg = await runTimed(
          "getNotificationMessage",
          () => connection.getNotificationMessage(2_000),
          MS.cmd,
        );
        expect(
          notifMsg.completion,
          `${JAVA_ORACLE.getNotificationMessage} completion=${notifMsg.completion} result=${notifMsg.result}`,
        ).to.equal("notification");
      },
    },
  ];
}

export async function runNotificationCommandSteps(
  run: RunCommand,
  server: RunningServer,
  connection: ICBConnection,
  fixtures: RealCommandFixtures,
  ctx: { notifClientId: string },
): Promise<void> {
  for (const step of buildNotificationCommandSteps()) {
    await step.run(run, server, connection, fixtures, ctx);
  }
}
