import { expect } from "chai";
import { DEFAULT_RAW } from "../src/settings/defaults";
import { toMmkitServerConfig } from "../src/settings/to-server-config";

describe( "to-server-config", () => { it("maps property-sheet defaults to a MmkitServerConfig", () => { const config = toMmkitServerConfig(DEFAULT_RAW); expect(config.launch.executablePath).to.equal("cbserver"); expect(config.network.port).to.equal(4001); expect(config.paths.dataDir).to.equal("~/.mmkit"); expect(config.mmkit.clientToolName).to.equal("mmkit"); expect(config.mmkit.clientUserName).to.equal("user"); }); } );
