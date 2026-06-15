/**
 * One mocha `it` per notification-channel step — mock ports.
 */
/// <reference types="mocha" />
import {
  bootstrapLevelForNotificationStep,
  bootstrapNotificationSession,
  buildNotificationCommandSteps,
  makeRealCommandFixtures,
} from "./commandCatalog";
import {
  installMockTestGuards,
  PER_TEST_TIMEOUT_MS,
  runCommand,
  withMockSession,
} from "./mockHarness";

describe("CBServer notification step [mock port]", function () {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installMockTestGuards(this);
  for (const step of buildNotificationCommandSteps()) {
    it(`notify/${step.label}`, async function () {
      const fixtures = makeRealCommandFixtures();
      const level = bootstrapLevelForNotificationStep(step.label);
      await withMockSession(`notify-${step.label}`, async ({ server, connection }) => {
        const ctx = await bootstrapNotificationSession(runCommand, server, connection, fixtures, level);
        await step.run(runCommand, server, connection, fixtures, ctx);
      });
    });
  }
});
