import * as fs from "node:fs/promises";
import type { FsPort } from "../types";

export class RealFsPort implements FsPort {
  async ensureDir(path: string): Promise<void> {
    await fs.mkdir(path, { recursive: true });
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
