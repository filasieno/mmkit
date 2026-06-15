import { Text } from "three-text/vector";
import { createSlugWebGLRenderer } from "./slug-webgl-renderer";

interface MmkitNodeEditorConfig {
  hbWasm: string;
  font: string;
  greeting: string;
}

declare global {
  interface Window {
    __MMKIT_NODE_EDITOR__?: MmkitNodeEditorConfig;
  }
}

interface PlaneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

interface ViewState {
  zoom: number;
  panEmX: number;
  panEmY: number;
}

interface ViewLayout {
  width: number;
  height: number;
  baseEmScale: number;
  cx0: number;
  cy0: number;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 48;
const PADDING_RATIO = 0.12;
const MAX_FPS = 120;
const MIN_FRAME_MS = 1000 / MAX_FPS;

function setStatus(message: string, isError = false): void {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function createFpsTracker(el: HTMLElement, sampleMs = 500): () => void {
  let frames = 0;
  let lastSample = performance.now();

  return () => {
    frames += 1;
    const now = performance.now();
    const elapsed = now - lastSample;
    if (elapsed < sampleMs) return;
    const fps = Math.round((frames * 1000) / elapsed);
    frames = 0;
    lastSample = now;
    el.textContent = `${fps} fps`;
  };
}

/** Always-on rAF loop, present at most maxFps (vsync-aligned, no busy-spin). */
function startCappedRenderLoop(present: () => void): void {
  let lastPresentMs = 0;

  const tick = (now: number): void => {
    if (now - lastPresentMs >= MIN_FRAME_MS) {
      lastPresentMs = now;
      present();
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function clipFromPixel(px: number, py: number, width: number, height: number): { x: number; y: number } {
  return {
    x: (px / width) * 2 - 1,
    y: 1 - (py / height) * 2,
  };
}

/**
 * Slug GLSL stores translation in column 0/1 `.w` (indices 3 and 7).
 * Keep sy positive — negative Y scale breaks SlugDilate texcoord sync and mirrors glyphs.
 */
function fitTextMvpInto(
  out: Float32Array,
  layout: ViewLayout,
  bounds: PlaneBounds,
  view: ViewState
): void {
  const textW = Math.max(bounds.max.x - bounds.min.x, 1);
  const textH = Math.max(bounds.max.y - bounds.min.y, 1);
  const cx = layout.cx0 + view.panEmX;
  const cy = layout.cy0 + view.panEmY;
  const padX = layout.width * PADDING_RATIO;
  const padY = layout.height * PADDING_RATIO;
  const baseEmScale =
    layout.baseEmScale > 0
      ? layout.baseEmScale
      : Math.min((layout.width - padX * 2) / textW, (layout.height - padY * 2) / textH);
  const emScale = baseEmScale * view.zoom;
  const sx = (2 * emScale) / layout.width;
  const sy = (2 * emScale) / layout.height;
  out[0] = sx;
  out[1] = 0;
  out[2] = 0;
  out[3] = -cx * sx;
  out[4] = 0;
  out[5] = sy;
  out[6] = 0;
  out[7] = -cy * sy;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
}

function applyPanTranslation(mvp: Float32Array, layout: ViewLayout, view: ViewState): void {
  const cx = layout.cx0 + view.panEmX;
  const cy = layout.cy0 + view.panEmY;
  mvp[3] = -cx * mvp[0];
  mvp[7] = -cy * mvp[5];
}

function viewStatusSuffix(zoom: number, desynced: boolean): string {
  const mode = desynced ? `desync · ${MAX_FPS}hz` : `${MAX_FPS}hz`;
  return ` · ${Math.round(zoom * 100)}% · ${mode} (scroll to zoom, middle-drag to pan)`;
}

function canvasPixelFromPointer(event: PointerEvent, dpr: number): { x: number; y: number } {
  return {
    x: event.offsetX * dpr,
    y: event.offsetY * dpr,
  };
}

function applyPixelPanDelta(
  view: ViewState,
  mvp: Float32Array,
  dx: number,
  dy: number,
  width: number,
  height: number
): void {
  view.panEmX -= (2 * dx) / width / mvp[0];
  view.panEmY += (2 * dy) / height / mvp[5];
}

async function boot(): Promise<void> {
  const config = window.__MMKIT_NODE_EDITOR__;
  if (!config) {
    setStatus("Node editor configuration is missing.", true);
    return;
  }

  const canvas = document.getElementById("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    setStatus("Canvas element not found.", true);
    return;
  }

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    desynchronized: true,
    powerPreference: "high-performance",
  });
  if (!gl) {
    setStatus("WebGL2 is required for the ConceptBase browser.", true);
    return;
  }

  const desynced = gl.getContextAttributes()?.desynchronized === true;

  Text.setHarfBuzzPath(config.hbWasm);

  const slugRenderer = createSlugWebGLRenderer(gl, { adaptiveSupersampling: false });
  const textResult = await Text.create({
    text: config.greeting,
    font: config.font,
    size: 180,
    color: [0.93, 0.95, 0.98, 1],
  });
  slugRenderer.setGeometry(textResult.gpuData);

  const view: ViewState = { zoom: 1, panEmX: 0, panEmY: 0 };
  const bounds = textResult.planeBounds;
  const layout: ViewLayout = {
    width: 1,
    height: 1,
    baseEmScale: 0,
    cx0: (bounds.min.x + bounds.max.x) * 0.5,
    cy0: (bounds.min.y + bounds.max.y) * 0.5,
  };
  const mvp = new Float32Array(16);
  fitTextMvpInto(mvp, layout, bounds, view);

  let dpr = window.devicePixelRatio || 1;
  let panPointerId: number | null = null;
  let lastPanX = 0;
  let lastPanY = 0;
  let displayedZoom = view.zoom;

  const refreshStatus = (): void => {
    if (displayedZoom === view.zoom) return;
    displayedZoom = view.zoom;
    setStatus(`Rendering with the Slug algorithm (GPU vector text)${viewStatusSuffix(view.zoom, desynced)}`);
  };

  const fpsEl = document.getElementById("fps");
  const trackFps = fpsEl instanceof HTMLElement ? createFpsTracker(fpsEl) : () => {};

  const drawFrame = (): void => {
    gl.clearColor(0.08, 0.09, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    slugRenderer.render(mvp);
    trackFps();
  };

  const applyZoom = (px: number, py: number, factor: number): void => {
    const clip = clipFromPixel(px, py, layout.width, layout.height);
    const emAx = (clip.x - mvp[3]) / mvp[0];
    const emAy = (clip.y - mvp[7]) / mvp[5];

    const oldZoom = view.zoom;
    view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
    const scaleRatio = oldZoom / view.zoom;

    view.panEmX = emAx - layout.cx0 - scaleRatio * (emAx - layout.cx0 - view.panEmX);
    view.panEmY = emAy - layout.cy0 - scaleRatio * (emAy - layout.cy0 - view.panEmY);
    fitTextMvpInto(mvp, layout, bounds, view);
    refreshStatus();
  };

  const applyPanPixels = (fromX: number, fromY: number, toX: number, toY: number): void => {
    applyPixelPanDelta(view, mvp, toX - fromX, toY - fromY, layout.width, layout.height);
    applyPanTranslation(mvp, layout, view);
  };

  const resize = (): void => {
    dpr = window.devicePixelRatio || 1;
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    layout.width = Math.floor(width * dpr);
    layout.height = Math.floor(height * dpr);
    canvas.width = layout.width;
    canvas.height = layout.height;
    gl.viewport(0, 0, layout.width, layout.height);
    const textW = Math.max(bounds.max.x - bounds.min.x, 1);
    const textH = Math.max(bounds.max.y - bounds.min.y, 1);
    const padX = layout.width * PADDING_RATIO;
    const padY = layout.height * PADDING_RATIO;
    layout.baseEmScale = Math.min((layout.width - padX * 2) / textW, (layout.height - padY * 2) / textH);
    fitTextMvpInto(mvp, layout, bounds, view);
  };

  const stopPan = (event: PointerEvent): void => {
    if (panPointerId === null || event.pointerId !== panPointerId) return;
    panPointerId = null;
    canvas.classList.remove("panning");
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    refreshStatus();
  };

  canvas.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 1) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    panPointerId = event.pointerId;
    const { x, y } = canvasPixelFromPointer(event, dpr);
    lastPanX = x;
    lastPanY = y;
    canvas.classList.add("panning");
  });

  canvas.addEventListener("pointermove", (event: PointerEvent) => {
    if (panPointerId === null || event.pointerId !== panPointerId) return;
    const events =
      typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
    for (const moveEvent of events) {
      const { x, y } = canvasPixelFromPointer(moveEvent, dpr);
      applyPanPixels(lastPanX, lastPanY, x, y);
      lastPanX = x;
      lastPanY = y;
    }
  });

  canvas.addEventListener("pointerup", stopPan);
  canvas.addEventListener("pointercancel", stopPan);

  canvas.addEventListener(
    "wheel",
    (event: WheelEvent) => {
      event.preventDefault();
      applyZoom(event.offsetX * dpr, event.offsetY * dpr, Math.exp(-event.deltaY * 0.001));
    },
    { passive: false }
  );

  startCappedRenderLoop(drawFrame);

  resize();
  setStatus(`Rendering with the Slug algorithm (GPU vector text)${viewStatusSuffix(view.zoom, desynced)}`);
  window.addEventListener("resize", resize);
}

void boot().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  setStatus(`Failed to start WebGL2 editor: ${message}`, true);
});
