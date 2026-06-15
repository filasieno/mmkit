import * as ihsm from "ihsm";
import type { MmkitTraceWriter } from "./trace";
import { createMmkitDispatchErrorHandler, mmkitTraceLevel } from "./trace";

export interface MmkitHsmCtx {
  trace: MmkitTraceWriter;
}

export function makeMmkitHsm<Context extends MmkitHsmCtx, Protocol extends {} | undefined>(
  topState: ihsm.StateClass<Context, Protocol>,
  ctx: Context
): ihsm.Hsm<Context, Protocol> {
  return ihsm.makeHsm(
    topState,
    ctx,
    true,
    mmkitTraceLevel(),
    ctx.trace,
    createMmkitDispatchErrorHandler(ctx.trace) as ihsm.DispatchErrorCallback<Context, Protocol>
  );
}
