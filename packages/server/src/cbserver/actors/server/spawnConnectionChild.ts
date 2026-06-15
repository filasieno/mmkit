import type * as ihsm from "ihsm";
import { spawnChildActor } from "../../shared/cbChildSpawn";
import { CBConnectionTop, type CBConnectionActor } from "../connection/CBServerConnectionConfig";
import type { CBConnectionContext } from "../connection/CBServerConnectionContext";
import { ConnectionUninitialized } from "../connection/CBServerConnectionActor";
import type { CBServerTop } from "./CBServerConfig";
import type { CBConnectionOrchestratorPort } from "../connection/CBConnectionOrchestratorPort";

export async function spawnConnectionChild(
  parent: ihsm.ParentActor<typeof CBServerTop>,
  context: CBConnectionContext,
  orchestratorPort: CBConnectionOrchestratorPort,
): Promise<CBConnectionActor> {
  const child = spawnChildActor(parent, CBConnectionTop, context, orchestratorPort, { initialize: false });
  child.hsm.restore(ConnectionUninitialized, context);
  await child.call.initialize();
  return child;
}
