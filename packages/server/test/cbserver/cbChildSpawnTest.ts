import * as ihsm from "ihsm/testing";
import { cbActorSpawnOptions } from "../../src/cbserver/shared/cbActorSpawnOptions";

/** Test child spawn — `makeTestActor` instead of `makeChildActor` (mock port default). */
export function spawnTestChildActor<
  ChildT extends ihsm.TopStateArg<ihsm.ActorConfig>,
>(
  topState: ihsm.ValidatedTopStateArg<ChildT>,
  ctx: ihsm.ActorContextOf<ihsm.ActorConfigOf<ChildT>>,
  port?: ihsm.MachinePortInput<ihsm.ActorConfigOf<ChildT>>,
  options?: { initialize?: boolean },
): ihsm.TestActor<ihsm.ActorConfigOf<ChildT>> {
  return ihsm.makeTestActor(topState, ctx, port, cbActorSpawnOptions(options));
}
