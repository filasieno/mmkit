import * as ihsm from "ihsm";

export function createLspHsm<Context extends object, Protocol extends {} | undefined>(
  topState: ihsm.StateClass<Context, Protocol>,
  ctx: Context
): ihsm.Hsm<Context, Protocol> {
  return ihsm.makeHsm(topState, ctx, true);
}
