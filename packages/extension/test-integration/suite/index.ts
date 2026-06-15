import * as path from "node:path";
import Mocha from "mocha";

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", timeout: 60_000 });
  mocha.addFile(path.resolve(__dirname, "hello-world.test.js"));

  return new Promise( (resolve, reject) => { mocha.run((failures: number) => { if (failures) { reject(new Error(`${failures} test(s) failed`)); return; } resolve(); }); } );
}
