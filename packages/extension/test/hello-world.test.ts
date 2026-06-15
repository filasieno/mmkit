import { expect } from "chai";
import { HELLO_WORLD_COMMAND, HELLO_WORLD_MESSAGE } from "@mmkit/shared";
import { registerHelloWorldCommand } from "../src/commands/hello-world";

describe("hello world command", () => {
  it("registers the shared command id and shows the shared message", async () => {
    const subscriptions: { dispose(): void }[] = [];
    const shown: string[] = [];
    let handler: (() => Promise<string>) | undefined;

    const vscodeApi = {
      commands: {
        registerCommand(id: string, fn: () => Promise<string>) {
          expect(id).to.equal(HELLO_WORLD_COMMAND);
          handler = fn;
          return { dispose() {} };
        },
      },
      window: {
        showInformationMessage(message: string) {
          shown.push(message);
          return Promise.resolve(message);
        },
      },
    } as unknown as typeof import("vscode");

    registerHelloWorldCommand(vscodeApi, { subscriptions } as import("vscode").ExtensionContext);

    expect(handler).to.be.a("function");
    const result = await handler!();

    expect(shown).to.deep.equal([HELLO_WORLD_MESSAGE]);
    expect(result).to.equal(HELLO_WORLD_MESSAGE);
    expect(subscriptions).to.have.length(1);
  });
});
