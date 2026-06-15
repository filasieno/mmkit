import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAnswerTerm, toCbAnswer } from "../src/cb-tcp";

describe("parseAnswerTerm", () => {
  it("parses simple ok answers", () => {
    const parsed = parseAnswerTerm('ipcanswer("CBserver_s1",ok,"System-oHome").');
    assert.equal(parsed.completion, "ok");
    assert.equal(parsed.sender, "CBserver_s1");
    assert.equal(parsed.returnData, "System-oHome");
    assert.equal(toCbAnswer(parsed).ok, true);
  });

  it("parses multiline FRAME listModule results", () => {
    const body = [
      "{",
      "* Module: System-oHome-MmkitCmd",
      "Employee in Class with",
      "   attribute",
      "    empno : Integer",
      "end",
      "}",
    ].join("\n");
    const term = `ipcanswer("CBserver_s1",ok,"${body.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}").`;
    const parsed = parseAnswerTerm(term);
    assert.equal(parsed.completion, "ok", `term parse failed: ${parsed.completion}`);
    assert.equal(parsed.returnData, body);
    assert.equal(toCbAnswer(parsed).ok, true);
  });

  it("returns broken for malformed terms", () => {
    assert.equal(parseAnswerTerm("not-a-term").completion, "broken");
  });
});
