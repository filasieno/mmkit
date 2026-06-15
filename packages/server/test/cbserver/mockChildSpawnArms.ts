import * as ihsm from "ihsm/testing";
import type { CBServerActorRef } from "../../src/cbserver/actors/server/CBServerConfig";
import {
  StdoutLogReaderTop,
  StdoutLogUninitialized,
  createStdoutLogReaderContext,
} from "../../src/cbserver/actors/stdoutLogReader/CBServerStdoutLogReaderActor";
import {
  StderrLogReaderTop,
  StderrUninitialized,
  createStderrReaderContext,
} from "../../src/cbserver/actors/stderrLogReader/CBServerStderrReaderActor";
import type { LogReaderChildren } from "../../src/cbserver/actors/server/spawnLogReaderChildren";
import { spawnTestChildActor } from "./cbChildSpawnTest";

export async function testSpawnLogReaderChildren(server: CBServerActorRef): Promise<LogReaderChildren> {
  const stdoutCtx = createStdoutLogReaderContext(server);
  const stdoutLogReader = spawnTestChildActor(StdoutLogReaderTop, stdoutCtx, undefined, { initialize: false });
  stdoutLogReader.hsm.restore(StdoutLogUninitialized, stdoutCtx);
  await stdoutLogReader.call.initialize();

  const stderrCtx = createStderrReaderContext(server);
  const stderrLogReader = spawnTestChildActor(StderrLogReaderTop, stderrCtx, undefined, { initialize: false });
  stderrLogReader.hsm.restore(StderrUninitialized, stderrCtx);
  await stderrLogReader.call.initialize();

  return { stdoutLogReader, stderrLogReader } as LogReaderChildren;
}
