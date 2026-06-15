import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLaunchRequest, MmkitServerConfig } from "../src/server-config/MmkitServerConfig";

describe( "MmkitServerConfig", () => { it("builds a launch request from defaults", () => { const config = new MmkitServerConfig({ network: { port: 4001 }, }); const launch = buildLaunchRequest(config); assert.equal(launch.executablePath, "cbserver"); assert.ok(launch.args.includes("-p")); assert.ok(launch.args.includes("4001")); }); } );
