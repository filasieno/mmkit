import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HELLO_WORLD_COMMAND, HELLO_WORLD_MESSAGE } from "../src/commands";

describe( "shared commands", () => { it("exports stable hello-world command id and message", () => { assert.equal(HELLO_WORLD_COMMAND, "mmkit.helloWorld"); assert.match(HELLO_WORLD_MESSAGE, /Hello World/); }); } );
