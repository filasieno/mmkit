export const DOCKER_IMAGE_RUNTIME = {
  cbHome: "/opt/conceptbase",
  cbPool: "/opt/conceptbase/share",
  cbsDir: "/opt/conceptbase/share/serverSources/Prolog_Files",
  cblDir: "/opt/conceptbase/share/system-data",
  prologVariant: "SWI",
  cbVariant: "",
  containerWorkspace: "/data/workspace",
  containerTmp: "/tmp/cbserver",
} as const;
