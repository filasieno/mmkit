import * as ihsm from "ihsm";
import type { CBServerActorRef, CBServerTop } from "./CBServerConfig";
import { StdoutLogReaderTop } from "../stdoutLogReader/CBServerStdoutLogReaderActor";
import { StdoutLogReaderContext } from "../stdoutLogReader/CBServerStdoutLogReaderContext";
import type { IStdoutLogReaderContext } from "../stdoutLogReader/CBServerStdoutLogReaderContext";
import type { StdoutLogReaderMachineConfig } from "../stdoutLogReader/CBServerStdoutLogReaderConfig";
import { StderrLogReaderTop } from "../stderrLogReader/CBServerStderrReaderActor";
import { StderrReaderContext } from "../stderrLogReader/CBServerStderrReaderContext";
import type { IStderrReaderContext } from "../stderrLogReader/CBServerStderrReaderContext";
import type { StderrLogReaderMachineConfig } from "../stderrLogReader/CBServerStderrReaderConfig";
import { CbActorSpawnOptions } from "../../shared/cbActorSpawnOptions";

export async function spawnStdoutLogReaderChild(parent: ihsm.ParentActor<typeof CBServerTop>, ctx: IStdoutLogReaderContext): Promise<ihsm.ChildActor<StdoutLogReaderMachineConfig>> {
  const child = ihsm.makeChildActor(parent, StdoutLogReaderTop, ctx, undefined, new CbActorSpawnOptions());
  await child.hsm.sync();
  return child;
}

export async function spawnStderrLogReaderChild(parent: ihsm.ParentActor<typeof CBServerTop>, ctx: IStderrReaderContext): Promise<ihsm.ChildActor<StderrLogReaderMachineConfig>> {
  const child = ihsm.makeChildActor(parent, StderrLogReaderTop, ctx, undefined, new CbActorSpawnOptions());
  await child.hsm.sync();
  return child;
}

export async function spawnLogReaderChildren(parent: ihsm.ParentActor<typeof CBServerTop>, server: CBServerActorRef) {
  const stdoutLogReader = await spawnStdoutLogReaderChild(parent, new StdoutLogReaderContext(server));
  const stderrLogReader = await spawnStderrLogReaderChild(parent, new StderrReaderContext(server));
  return { stdoutLogReader, stderrLogReader };
}
