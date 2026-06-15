import * as os from "node:os";

/** ENROLL_ME user suffix — matches Java LocalCBclient host/arch/platform tagging. */
export function enrollUserSuffix(userName = "mmkit"): string {
  return `${userName}@${os.hostname()}_${os.arch()}_${os.platform().replace(/\s/g, "")}`;
}
