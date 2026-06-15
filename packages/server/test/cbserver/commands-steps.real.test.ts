/**
 * One mocha `it` per IPC command — each must finish within MMKIT_REAL_PER_TEST_MS (default 5s).
 * Run via: `bash scripts/test-cbserver-real-one-by-one.sh`
 */
/// <reference types="mocha" />
import { bootstrapLevelForCommandStep, bootstrapRealCommandSession, buildRealCommandSteps, makeRealCommandFixtures, } from "./commandCatalog";
import { describeReal, installRealTestGuards, PER_TEST_TIMEOUT_MS, runCommand, withRealSession, } from "./realHarness";

describeReal( "CBServer command step [real cbserver]", function () { this.timeout(PER_TEST_TIMEOUT_MS); installRealTestGuards(this); for (const step of buildRealCommandSteps()) { it(`step/${step.label}`, async function () { const fixtures = makeRealCommandFixtures(); const level = bootstrapLevelForCommandStep(step.label); await withRealSession(`step-${step.label}`, async ({ server, connection }) => { const ctx = await bootstrapRealCommandSession(runCommand, server, connection, fixtures, level); await step.run(runCommand, server, connection, fixtures, ctx); }); }); } } );
