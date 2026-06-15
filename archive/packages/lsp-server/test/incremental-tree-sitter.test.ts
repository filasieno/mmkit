import { expect } from "chai";
import { DocumentRegistry } from "../src/lsp/document-registry";
import { validateConceptBaseDocument } from "../src/lsp/parse";
import {
  collectNodeTypes,
  countSyntaxErrors,
  isTreeSitterAvailable,
} from "../src/lsp/tree-sitter/runtime";
import {
  BROKEN_FRAME,
  EMPLOYEE_FRAME,
  MSFOL_ASSERTION,
  NOTEBOOK_CELL_A,
  UNICODE_FRAME,
} from "./fixtures/corpus";
import {
  applyEditSequence,
  applyEdits,
  createCbsDocument,
  deleteRange,
  insertAt,
  replaceRange,
} from "./helpers/edit-document";

const treeSitterDescribe = async (): Promise<void> => {
  if (!(await isTreeSitterAvailable())) {
    console.log("tree-sitter WASM unavailable — skipping grammar integration tests");
  }
};

describe("incremental TextDocument + tree-sitter grammar", function () {
  before(async function () {
    if (!(await isTreeSitterAvailable())) {
      this.skip();
    }
  });

  async function parseThroughRegistry(uri: string, doc: ReturnType<typeof createCbsDocument>) {
    const reg = new DocumentRegistry();
    reg.trackOpen(doc);
    await validateConceptBaseDocument(reg, doc);
    return reg;
  }

  it("parses Employee frame and finds telos_object", async () => {
    const uri = "file:///employee.cbs";
    const reg = await parseThroughRegistry(uri, createCbsDocument(uri, EMPLOYEE_FRAME, 1));
    const tree = reg.getTree(uri)!;
    const types = collectNodeTypes(tree.rootNode);
    expect(types.has("source_file")).to.equal(true);
    expect(types.has("telos_object")).to.equal(true);
    expect(countSyntaxErrors(tree.rootNode)).to.equal(0);
  });

  it("incremental insert inside attribute block preserves valid tree", async () => {
    const uri = "file:///insert.cbs";
    let doc = createCbsDocument(uri, EMPLOYEE_FRAME, 1);
    const reg = new DocumentRegistry();
    reg.trackOpen(doc);
    await validateConceptBaseDocument(reg, doc);
    const errorsBefore = countSyntaxErrors(reg.getTree(uri)!.rootNode);

    doc = insertAt(doc, 2, 4, "    salary : Integer\n");
    reg.trackSyncedDocument(doc);
    await validateConceptBaseDocument(reg, doc);

    expect(countSyntaxErrors(reg.getTree(uri)!.rootNode)).to.equal(errorsBefore);
    expect(collectNodeTypes(reg.getTree(uri)!.rootNode).has("property")).to.equal(true);
  });

  it("inserting garbage mid-frame increases ERROR count then heals on undo", async () => {
    const uri = "file:///break-end.cbs";
    let doc = createCbsDocument(uri, EMPLOYEE_FRAME, 1);
    const reg = new DocumentRegistry();
    reg.trackOpen(doc);
    await validateConceptBaseDocument(reg, doc);
    expect(countSyntaxErrors(reg.getTree(uri)!.rootNode)).to.equal(0);

    doc = insertAt(doc, 1, 0, "@@@ broken\n");
    reg.trackSyncedDocument(doc);
    const diagsBroken = await validateConceptBaseDocument(reg, doc);
    expect(
      countSyntaxErrors(reg.getTree(uri)!.rootNode) + diagsBroken.length
    ).to.be.greaterThan(0);

    const endPos = doc.positionAt(doc.getText().length);
    doc = replaceRange(doc, { line: 0, character: 0 }, endPos, EMPLOYEE_FRAME);
    reg.setTree(uri, undefined);
    reg.trackSyncedDocument(doc);
    await validateConceptBaseDocument(reg, doc);
    expect(countSyntaxErrors(reg.getTree(uri)!.rootNode)).to.equal(0);
  });

  it("multi-batch edit sequence: type assertion fragment", async () => {
    const uri = "file:///assertion.cbs";
    const batches = [
      [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: "$ " }],
      [{ range: { start: { line: 0, character: 2 }, end: { line: 0, character: 2 } }, text: "forall " }],
    ];
    let doc = createCbsDocument(uri, "", 1);
    doc = applyEditSequence(doc, batches);
    doc = applyEdits(doc, [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: doc.getText().length } }, text: MSFOL_ASSERTION }], 4);

    const reg = new DocumentRegistry();
    reg.trackOpen(doc);
    await validateConceptBaseDocument(reg, doc);
    const types = collectNodeTypes(reg.getTree(uri)!.rootNode);
    expect(types.has("assertion_embedding")).to.equal(true);
  });

  it("unicode identifiers in strings parse without ERROR nodes", async () => {
    const uri = "file:///unicode.cbs";
    const reg = await parseThroughRegistry(uri, createCbsDocument(uri, UNICODE_FRAME, 1));
    expect(countSyntaxErrors(reg.getTree(uri)!.rootNode)).to.equal(0);
  });

  it("notebook cell URI uses same registry path as .cbs", async () => {
    const uri = "vscode-notebook-cell:/book.mmnb#c1";
    const reg = await parseThroughRegistry(uri, createCbsDocument(uri, NOTEBOOK_CELL_A, 1));
    expect(collectNodeTypes(reg.getTree(uri)!.rootNode).has("telos_object")).to.equal(true);
  });

  it("replacing broken frame with valid text clears syntax errors incrementally", async () => {
    const uri = "file:///heal.cbs";
    let doc = createCbsDocument(uri, BROKEN_FRAME, 1);
    const reg = new DocumentRegistry();
    reg.trackOpen(doc);
    await validateConceptBaseDocument(reg, doc);
    expect(countSyntaxErrors(reg.getTree(uri)!.rootNode)).to.be.greaterThan(0);

    const endPos = doc.positionAt(doc.getText().length);
    doc = replaceRange(doc, { line: 0, character: 0 }, endPos, EMPLOYEE_FRAME);
    reg.trackSyncedDocument(doc);
    await validateConceptBaseDocument(reg, doc);
    expect(countSyntaxErrors(reg.getTree(uri)!.rootNode)).to.equal(0);
  });

  it("registry version stays aligned with document after each edit", async () => {
    const uri = "file:///ver.cbs";
    let doc = createCbsDocument(uri, "x", 1);
    const reg = new DocumentRegistry();
    reg.trackOpen(doc);
    for (let v = 2; v <= 5; v++) {
      doc = insertAt(doc, 0, doc.getText().length, "y");
      const sync = reg.trackSyncedDocument(doc);
      expect(sync.ok).to.equal(true);
      expect(reg.getAcceptedVersion(uri)).to.equal(v);
      expect(reg.getConceptBaseDocument(uri)?.version).to.equal(v);
    }
  });

  it("stale registry sync does not advance version or replace tree binding", async () => {
    const uri = "file:///stale.cbs";
    const reg = new DocumentRegistry();
    reg.trackOpen(createCbsDocument(uri, EMPLOYEE_FRAME, 2));
    await validateConceptBaseDocument(reg, reg.getBuffer(uri)!);
    const treeBefore = reg.getTree(uri);

    const staleDoc = createCbsDocument(uri, "stale", 1);
    const sync = reg.trackSyncedDocument(staleDoc);
    expect(sync.ok).to.equal(false);
    expect(reg.getAcceptedVersion(uri)).to.equal(2);
    expect(reg.getTree(uri)).to.equal(treeBefore);
  });
});

void treeSitterDescribe;
