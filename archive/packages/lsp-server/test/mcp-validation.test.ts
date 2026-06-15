import { expect } from "chai";
import { McpValidationError } from "../src/mcp/validation/errors";
import { requireObject, requireString } from "../src/mcp/validation/validate-args";
import { validateConceptBaseText } from "../src/lsp/validate-conceptbase-text";
import { isTreeSitterAvailable } from "../src/lsp/tree-sitter/runtime";
import { BROKEN_FRAME, EMPLOYEE_FRAME } from "./fixtures/corpus";

describe("MCP validation", () => {
  it("rejects non-object args", () => {
    expect(() => requireObject("bad", "cb_tell")).to.throw(McpValidationError);
  });

  it("rejects control characters in strings", () => {
    expect(() => requireString({ frames: "a\u0001b" }, "frames")).to.throw(McpValidationError);
  });

  it("rejects empty frames", () => {
    expect(() => requireString({ frames: "   " }, "frames")).to.throw(McpValidationError);
  });

  it("validates well-formed ConceptBase frame text", async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
    const result = await validateConceptBaseText(EMPLOYEE_FRAME);
    expect(result.ok).to.equal(true);
    expect(result.parser).to.equal("tree-sitter");
  });

  it("rejects broken frame when tree-sitter is available", async function () {
    if (!(await isTreeSitterAvailable())) this.skip();
    const result = await validateConceptBaseText(BROKEN_FRAME);
    expect(result.ok).to.equal(false);
    expect(result.issues.length).to.be.greaterThan(0);
  });

  it("rejects broken brackets via bracket fallback", async () => {
    const result = await validateConceptBaseText("frame ( unclosed");
    expect(result.ok).to.equal(false);
    expect(result.issues.length).to.be.greaterThan(0);
  });
});
