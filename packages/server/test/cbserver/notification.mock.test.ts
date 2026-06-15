/**
 * Mock ports — CInterface.typ notification extension (identical to notification.real.test.ts).
 */
/// <reference types="mocha" />
import * as fs from "node:fs/promises";
import { makeRealCommandFixtures, runNotificationCommandSteps } from "./commandCatalog";
import { waitCommand } from "../../src/cbserver/shared/CBServerDefs";
import {
  installMockTestGuards,
  MS,
  PER_TEST_TIMEOUT_MS,
  runCommand,
  runTimed,
  withMockSession,
} from "./mockHarness";

describe("CBServer notification [mock port]", function () {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installMockTestGuards(this);

  it("NOTIFICATION_REQUEST on notification channel client id (Java CBConnection)", async function () {
    const fixtures = makeRealCommandFixtures();
    await withMockSession("notify", async ({ server, connection }) => {
      const ctx = {
        notifClientId: await runTimed(
          "getNotificationClientId",
          () => connection.call.getNotificationClientId(),
          MS.identity,
        ),
      };
      await runCommand(server, connection, "mkdir", () => waitCommand(connection.call.mkdir(fixtures.mod)));
      await runCommand(server, connection, "cd", () => waitCommand(connection.call.cd(fixtures.mod)));
      await runTimed(
        "write-sml",
        () => fs.writeFile(`${fixtures.smlBase}.sml`, `${fixtures.smlModel}\n`, "utf8"),
        MS.step,
      );
      await runCommand(server, connection, "tellModel", () => waitCommand(connection.call.tellModel(fixtures.smlBase)));
      await runCommand(server, connection, "tell-bill", () => waitCommand(connection.call.tell(fixtures.framesBill)));
      await runNotificationCommandSteps(runCommand, server, connection, fixtures, ctx);
    });
  });
});
