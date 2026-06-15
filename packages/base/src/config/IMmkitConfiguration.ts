import type { IMmkitClientConfig } from "./MmkitClientConfig";
import type { IMmkitLanguageServerConfig } from "./MmkitLanguageServerConfig";
import type { IMmkitOperationalConfig } from "./MmkitOperationalConfig";
import type { IMmkitServerConfig } from "../server-config/MmkitServerConfig";

/**
 * Complete mmkit runtime configuration contract.
 *
 * The VS Code extension reads workspace settings, validates them, and maps
 * each group into these interfaces. {@link @mmkit/server} and future actors
 * depend only on this shape — not on VS Code setting ids or UI metadata.
 *
 * @see {@link IMmkitOperationalConfig} — process mode and extension trace level
 * @see {@link IMmkitLanguageServerConfig} — LSP/HTTP host ports
 * @see {@link IMmkitServerConfig} — local cbserver launch and runtime flags
 * @see {@link IMmkitClientConfig} — remote TCP client when mode is `client`
 */
export interface IMmkitConfiguration {
  operational: IMmkitOperationalConfig;
  languageServer: IMmkitLanguageServerConfig;
  server: IMmkitServerConfig;
  client: IMmkitClientConfig;
}
