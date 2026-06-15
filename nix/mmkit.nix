# mmkit — Metamodelling Kit VS Code extension (packaged as a .vsix via vsce).
{
  lib,
  stdenvNoCC,
  vsce,
  nodejs,
  esbuild,
  src,
}:

stdenvNoCC.mkDerivation rec {
  pname = "mmkit";
  version = "0.2.0";
  inherit src;

  nativeBuildInputs = [ vsce nodejs esbuild ];

  dontConfigure = true;
  doCheck = true;

  buildPhase = ''
    runHook preBuild
    export HOME="$TMPDIR"
    cp -r --no-preserve=mode,ownership "$src" build
    cd build

    npm install --workspaces --include=dev
    npm run build

    cd packages/extension
    vsce package --no-dependencies --out "mmkit-${version}.vsix"
    cd ../..
    runHook postBuild
  '';

  checkPhase = ''
    runHook preCheck
    export HOME="$TMPDIR"
    cd build
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
    cp "build/packages/extension/mmkit-${version}.vsix" "$out/"
    runHook postInstall
  '';

  meta = with lib; {
    description = "ConceptBase Metamodelling Kit — VS Code extension";
    homepage = "https://github.com/filasieno/mmkit";
    platforms = [ "x86_64-linux" ];
    license = licenses.bsd2;
  };
}
