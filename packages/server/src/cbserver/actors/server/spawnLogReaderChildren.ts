import type * as ihsm from "ihsm";
import type { CBServerActorRef } from "./CBServerConfig";
import type { CBServerTop } from "./CBServerConfig";
import {
  StdoutLogReaderTop,
  StdoutLogUninitialized,
  createStdoutLogReaderContext,
} from "../stdoutLogReader/CBServerStdoutLogReaderActor";
import type { IStdoutLogReaderContext } from "../stdoutLogReader/CBServerStdoutLogReaderContext";
import type { StdoutLogReaderMachineConfig } from "../stdoutLogReader/CBServerStdoutLogReaderConfig";
import {
  StderrLogReaderTop,
  StderrUninitialized,
  createStderrReaderContext,
} from "../stderrLogReader/CBServerStderrReaderActor";
import type { IStderrReaderContext } from "../stderrLogReader/CBServerStderrReaderContext";
import type { StderrLogReaderMachineConfig } from "../stderrLogReader/CBServerStderrReaderConfig";
import { spawnChildActor } from "../../shared/cbChildSpawn";

export async function spawnStdoutLogReaderChild(
  parent: ihsm.ParentActor<typeof CBServerTop>,
  ctx: IStdoutLogReaderContext,
): Promise<ihsm.ChildActor<StdoutLogReaderMachineConfig>> {
  const child = spawnChildActor(parent, StdoutLogReaderTop, ctx, undefined, { initialize: false });
  child.hsm.restore(StdoutLogUninitialized, ctx);
  await child.call.initialize();
  return child;
}

export async function spawnStderrLogReaderChild(
  parent: ihsm.ParentActor<typeof CBServerTop>,
  ctx: IStderrReaderContext,
): Promise<ihsm.ChildActor<StderrLogReaderMachineConfig>> {
  const child = spawnChildActor(parent, StderrLogReaderTop, ctx, undefined, { initialize: false });
  child.hsm.restore(StderrUninitialized, ctx);
  await child.call.initialize();
  return child;
}

export type LogReaderChildren = {
  stdoutLogReader: ihsm.ChildActor<StdoutLogReaderMachineConfig>;
  stderrLogReader: ihsm.ChildActor<StderrLogReaderMachineConfig>;
};

export async function spawnLogReaderChildren(
  parent: ihsm.ParentActor<typeof CBServerTop>,
  server: CBServerActorRef,
): Promise<LogReaderChildren> {
  const stdoutLogReader = await spawnStdoutLogReaderChild(parent, createStdoutLogReaderContext(server));
  const stderrLogReader = await spawnStderrLogReaderChild(parent, createStderrReaderContext(server));
  return { stdoutLogReader, stderrLogReader };
}
