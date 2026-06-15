/**
 * One mocha `it` per notification-channel step — 5s budget each in fast mode.
 */
/// <reference types="mocha" />
import {
  bootstrapLevelForNotificationStep,
  bootstrapNotificationSession,
  buildNotificationCommandSteps,
  makeRealCommandFixtures,
} from "./commandCatalog";
import {
  describeReal,
  installRealTestGuards,
  PER_TEST_TIMEOUT_MS,
  runCommand,
  withRealSession,
} from "./realHarness";

describeReal("CBServer notification step [real cbserver]", function () {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installRealTestGuards(this);

  for (const step of buildNotificationCommandSteps()) {
    it(`notify/${step.label}`, async function () {
      const fixtures = makeRealCommandFixtures();
      const level = bootstrapLevelForNotificationStep(step.label);
      await withRealSession(`notify-${step.label}`, async ({ server, connection }) => {
        const ctx = await bootstrapNotificationSession(runCommand, server, connection, fixtures, level);
        await step.run(runCommand, server, connection, fixtures, ctx);
      });
    });
  }
});
