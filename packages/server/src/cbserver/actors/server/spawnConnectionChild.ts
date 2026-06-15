import * as ihsm from "ihsm";
// Side-effect: register ConnectionBootstrap → Connecting @InitialState chain before spawn init.
import "../connection/CBServerConnectionActor";
import { CBConnectionTop } from "../connection/CBServerConnectionConfig";
import type { CBConnectionActor } from "../connection/CBServerConnectionConfig";
import type { CBConnectionContext } from "../connection/CBServerConnectionContext";
import type { CBServerTop } from "./CBServerConfig";
import type { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";
import { CbActorSpawnOptions } from "../../shared/cbActorSpawnOptions";

export async function spawnConnectionChild(parent: ihsm.ParentActor<typeof CBServerTop>, context: CBConnectionContext, orchestratorPort: CBConnectionOrchestratorPort): Promise<CBConnectionActor> {
  const child = ihsm.makeChildActor(parent, CBConnectionTop, context, orchestratorPort, new CbActorSpawnOptions());
  await child.hsm.sync();
  return child;
}
