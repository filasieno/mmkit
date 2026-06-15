import * as path from "node:path";
import Mocha from "mocha";
import { glob } from "glob";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", timeout: 120_000 });
  const files = await glob("**/*.test.js", { cwd: __dirname });
  for (const file of files) {
    mocha.addFile(path.resolve(__dirname, file));
  }
  await new Promise<void>((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) reject(new Error(`${failures} integration test(s) failed`));
      else resolve();
    });
  });
}
