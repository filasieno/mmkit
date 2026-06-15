/**
 * Shared harness types — real and mock suites exercise the same actor graph;
 * only the port implementations differ.
 */
import type * as ihsm from "ihsm/testing";
import type { CBServerTop } from "../../src/cbserver/actors/server/CBServerActor";
import type { CBServerContext } from "../../src/cbserver/actors/server/CBServerContext";
import type { CBAnswer, CBConnectionActorHandle } from "../../src/cbserver/shared/CBServerDefs";

export type RunningServer = {
  actor: ReturnType<typeof ihsm.makeTestActor<typeof CBServerTop>>;
  ctx: CBServerContext;
  port: unknown;
};

export type TestSession = {
  server: RunningServer;
  connection: CBConnectionActorHandle;
};

export type RunCommand = (
  server: RunningServer,
  connection: CBConnectionActorHandle,
  label: string,
  work: () => Promise<CBAnswer>,
) => Promise<CBAnswer>;
