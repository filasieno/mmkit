/**
 * CInterface.typ notification extension — dual-socket pattern from Java CBConnection.
 *
 * Requires a told View object before view(ViewName) NOTIFICATION_REQUEST.
 */
/// <reference types="mocha" />
import * as fs from "node:fs/promises";
import {
  makeRealCommandFixtures,
  runNotificationCommandSteps,
} from "./commandCatalog";
import {
  describeReal,
  installRealTestGuards,
  MS,
  PER_TEST_TIMEOUT_MS,
  runCommand,
  runTimed,
  withRealSession,
} from "./realHarness";

describeReal("CBServer notification [real cbserver]", function () {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installRealTestGuards(this);

  it("NOTIFICATION_REQUEST on notification channel client id (Java CBConnection)", async function () {
    const fixtures = makeRealCommandFixtures();
    await withRealSession("notify", async ({ server, connection }) => {
      const ctx = {
        notifClientId: await runTimed(
          "getNotificationClientId",
          () => connection.getNotificationClientId(),
          MS.identity,
        ),
      };
      await runCommand(server, connection, "mkdir", () => connection.mkdir(fixtures.mod));
      await runCommand(server, connection, "cd", () => connection.cd(fixtures.mod));
      await runTimed("write-sml", () => fs.writeFile(`${fixtures.smlBase}.sml`, `${fixtures.smlModel}\n`, "utf8"), MS.step);
      await runCommand(server, connection, "tellModel", () => connection.tellModel(fixtures.smlBase));
      await runCommand(server, connection, "tell-bill", () => connection.tell(fixtures.framesBill));
      await runNotificationCommandSteps(runCommand, server, connection, fixtures, ctx);
    });
  });
});
