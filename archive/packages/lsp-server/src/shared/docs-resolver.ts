import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { otelLogger } from "./telemetry/otel";

const log = otelLogger("mmkit-docs");

/**
 * Locate the ConceptBase HTML docs root (`…/share/doc/`).
 *
 * Resolution order:
 *   1. `MMKIT_CONCEPTBASE_DOCS_DIR`  — explicit override
 *   2. `MMKIT_CONCEPTBASE_FLAKE`#docs — nix build (instant when already cached)
 *   3. Auto-detect flake path by walking up from __dirname
 */
export function resolveConceptBaseDocsDir(): string | undefined {
  const explicit = process.env.MMKIT_CONCEPTBASE_DOCS_DIR;
  if (explicit) {
    if (fs.existsSync(explicit)) return path.resolve(explicit);
    log.emit({ severityText: "WARN", body: "MMKIT_CONCEPTBASE_DOCS_DIR not found", attributes: { path: explicit } });
    return undefined;
  }

  const flake = process.env.MMKIT_CONCEPTBASE_FLAKE ?? detectFlakePath();
  if (!flake) {
    log.emit({ severityText: "INFO", body: "docs not found — set MMKIT_CONCEPTBASE_DOCS_DIR or MMKIT_CONCEPTBASE_FLAKE" });
    return undefined;
  }

  try {
    const result = spawnSync("nix", ["build", `${flake}#docs`, "--print-out-paths", "--no-link", "--quiet"], {
      encoding: "utf8",
      timeout: 30_000,
    });
    const nixOut = result.stdout?.trim().split("\n")[0] ?? "";
    if (nixOut && fs.existsSync(nixOut)) {
      const docsDir = path.join(nixOut, "share", "doc");
      if (fs.existsSync(docsDir)) {
        log.emit({ severityText: "INFO", body: "docs resolved via nix build", attributes: { flake, path: docsDir } });
        return docsDir;
      }
    }
  } catch {
    log.emit({ severityText: "WARN", body: "nix build for docs failed — docs will not be served" });
  }

  return undefined;
}

/** Walk up from the running binary's dir looking for flake.nix. */
function detectFlakePath(): string | undefined {
  // __dirname in dist/ — walk up to find the monorepo root
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "flake.nix"))) return `path:${dir}`;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}
