import * as ihsm from "ihsm";
import { cbActorSpawnOptions } from "./cbActorSpawnOptions";

/** Production child spawn — always routed through a parent {@link ihsm.Port}. */
export function spawnChildActor<
  ParentT extends ihsm.TopStateArg<ihsm.ActorConfig>,
  ChildT extends ihsm.TopStateArg<ihsm.ActorConfig>,
>(
  parent: ihsm.ParentActor<ParentT>,
  childTop: ChildT,
  childCtx: ihsm.ActorContextOf<ihsm.ActorConfigOf<ChildT>>,
  port?: ihsm.MachinePortInput<ihsm.ActorConfigOf<ChildT>>,
  options?: { initialize?: boolean },
): ihsm.ChildActor<ihsm.ActorConfigOf<ChildT>> {
  return ihsm.makeChildActor(parent, childTop, childCtx, port, cbActorSpawnOptions(options));
}

export function parentFromPort(port: { actor: unknown }): ihsm.ParentActor<ihsm.TopStateArg<ihsm.ActorConfig>> {
  return ihsm.asParentActor(port.actor as ihsm.TopState<ihsm.ActorConfig>) as ihsm.ParentActor<
    ihsm.TopStateArg<ihsm.ActorConfig>
  >;
}
