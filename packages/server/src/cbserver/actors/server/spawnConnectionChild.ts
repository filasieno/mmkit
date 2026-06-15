import * as ihsm from "ihsm";
import { CBConnectionTop } from "../connection/CBServerConnectionConfig";
import type { CBConnectionActor } from "../connection/CBServerConnectionConfig";
import type { CBConnectionContext } from "../connection/CBServerConnectionContext";
import { ConnectionUninitialized } from "../connection/CBServerConnectionActor";
import type { CBServerTop } from "./CBServerConfig";
import type { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";
import { CbActorSpawnOptions } from "../../shared/cbActorSpawnOptions";

const spawnOptions = new CbActorSpawnOptions({ initialize: false });

export async function spawnConnectionChild(parent: ihsm.ParentActor<typeof CBServerTop>, context: CBConnectionContext, orchestratorPort: CBConnectionOrchestratorPort): Promise<CBConnectionActor> {
  const child = ihsm.makeChildActor(parent, CBConnectionTop, context, orchestratorPort, spawnOptions);
  child.hsm.restore(ConnectionUninitialized, context);
  await child.call.initialize();
  return child;
}
