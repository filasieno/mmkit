# mmkit — Metamodelling Kit VS Code extension (packaged as a .vsix via vsce).
{
  lib,
  stdenvNoCC,
  vsce,
  nodejs,
  esbuild,
  src,
  npmDeps,
  npmConfigHook,
}:

stdenvNoCC.mkDerivation rec {
  pname = "mmkit";
  version = "0.2.0";
  inherit src npmDeps;

  npmInstallFlags = [ "--include=optional" ];

  nativeBuildInputs = [ vsce nodejs esbuild npmConfigHook ];

  dontConfigure = true;
  doCheck = true;

  buildPhase = ''
    runHook preBuild
    export HOME="$TMPDIR"

    npm run build -w @mmkit/shared
    npm run build -w @mmkit/server
    npm run build -w mmkit

    cd packages/extension
    echo y | vsce package --no-dependencies --allow-missing-repository --out "mmkit-${version}.vsix"
    cd ../..
    runHook postBuild
  '';

  checkPhase = ''
    runHook preCheck
    export HOME="$TMPDIR"
    npm test
    test -s packages/extension/out/extension.js
    test -s packages/server/dist/server.js
    node --check packages/extension/out/extension.js
    node --check packages/server/dist/server.js
    test -s packages/extension/mmkit-${version}.vsix
    runHook postCheck
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p "$out"
    cp "packages/extension/mmkit-${version}.vsix" "$out/"
    runHook postInstall
  '';

  meta = with lib; {
    description = "ConceptBase Metamodelling Kit — VS Code extension";
    homepage = "https://github.com/filasieno/mmkit";
    platforms = [ "x86_64-linux" ];
    license = licenses.bsd2;
  };
}
