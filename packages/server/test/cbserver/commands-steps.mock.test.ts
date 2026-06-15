/**
 * One mocha `it` per IPC command — mock ports (identical steps to commands-steps.real.test.ts).
 */
/// <reference types="mocha" />
import {
  bootstrapLevelForCommandStep,
  bootstrapRealCommandSession,
  buildRealCommandSteps,
  makeRealCommandFixtures,
} from "./commandCatalog";
import {
  installMockTestGuards,
  PER_TEST_TIMEOUT_MS,
  runCommand,
  withMockSession,
} from "./mockHarness";

describe("CBServer command step [mock port]", function () {
  this.timeout(PER_TEST_TIMEOUT_MS);
  installMockTestGuards(this);
  for (const step of buildRealCommandSteps()) {
    it(`step/${step.label}`, async function () {
      const fixtures = makeRealCommandFixtures();
      const level = bootstrapLevelForCommandStep(step.label);
      await withMockSession(`step-${step.label}`, async ({ server, connection }) => {
        const ctx = await bootstrapRealCommandSession(runCommand, server, connection, fixtures, level);
        await step.run(runCommand, server, connection, fixtures, ctx);
      });
    });
  }
});
