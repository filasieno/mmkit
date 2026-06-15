/** Shown only when mmkit server is not reachable within this window after start. */
export const FAST_START_THRESHOLD_MS = 2000;

export const INSTALL_MARKER_FILE = ".mmkit-installed";

/** Relative path under dataDir where materialize copies the cbserver binary. */
export const CBSERVER_INSTALL_REL_PATH = "bin/cbserver";

export const INSTALL_STEPS = [
  "prepare",
  "materialize",
  "dockerImage",
  "launch",
  "awaitPort",
] as const;

export type InstallStep = (typeof INSTALL_STEPS)[number];
