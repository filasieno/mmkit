{
  description = "mmkit — ConceptBase Metamodelling Kit (VS Code extension)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    conceptbase-cc.url = "github:filasieno/conceptbase-cc";
    conceptbase-cc.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, conceptbase-cc }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
      cbserver = conceptbase-cc.packages.${system}.cbserver;

      mmkitSrc = builtins.path {
        path = ./.;
        name = "mmkit-src";
        filter = path: type:
          let base = baseNameOf path;
          in base != "node_modules"
            && base != "out-test"
            && base != "out-test-integration"
            && base != "result"
            && base != ".git"
            && base != ".direnv";
      };
    in
    {
      packages.${system} = {
        mmkit = pkgs.callPackage ./nix/mmkit.nix {
          src = mmkitSrc;
          inherit (pkgs) vsce nodejs esbuild;
        };
        default = self.packages.${system}.mmkit;
      };

      devShells.${system} = {
        default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            nodejs
            maven
            jdk25
            swi-prolog
            cbserver
          ];
          shellHook = ''
            export CB_HOME=${cbserver}
            export CB_POOL=${cbserver}/share
            export CBS_DIR=${cbserver}/share/serverSources/Prolog_Files
            export CBL_DIR=${cbserver}/share/system-data
            export CB_VARIANT=""
            export MMKIT_REAL_CBSERVER_BIN=${cbserver}/bin/cbserver

            if [[ ! -x "$MMKIT_REAL_CBSERVER_BIN" ]]; then
              echo "ERROR: cbserver is missing (conceptbase-cc flake input)."
              return 1
            fi

            echo "mmkit dev shell"
            echo "  cbserver: $MMKIT_REAL_CBSERVER_BIN"
            echo "  CB_HOME:  $CB_HOME"
            echo ""
            echo "  npm install --workspaces --include=dev   # once"
            echo "  npm run test -w @mmkit/server"
            echo "  npm run test:cbserver:real -w @mmkit/server"
            echo "  # or: packages/server/scripts/test-cbserver-real.sh"
          '';
        };
      };

      checks.${system}.mmkit = self.packages.${system}.mmkit;

      formatter.${system} = pkgs.nixpkgs-fmt;
    };
}
