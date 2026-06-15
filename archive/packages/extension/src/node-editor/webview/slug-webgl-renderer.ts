import type { SlugGPUData } from "three-text/vector/core";
import {
  SLUG_FRAGMENT_SHADER,
  SLUG_FRAGMENT_SHADER_ADAPTIVE,
  SLUG_VERTEX_SHADER,
} from "./slug-shaders.generated";

export interface SlugWebGLRenderer {
  setGeometry(data: SlugGPUData): void;
  render(mvp: Float32Array): void;
  dispose(): void;
}

export interface SlugWebGLRendererOptions {
  adaptiveSupersampling?: boolean;
}

interface RendererResources {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  curveTexture: WebGLTexture;
  bandTexture: WebGLTexture;
  uniforms: {
    slug_matrix: WebGLUniformLocation | null;
    slug_viewport: WebGLUniformLocation | null;
    curveTexture: WebGLUniformLocation | null;
    bandTexture: WebGLUniformLocation | null;
  };
  indexCount: number;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create Slug shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Slug shader compile failed: ${info ?? "unknown"}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error("Failed to create Slug program");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Slug program link failed: ${info ?? "unknown"}`);
  }
  return prog;
}

function createRGBA32FTexture(
  gl: WebGL2RenderingContext,
  data: Float32Array,
  width: number,
  height: number
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to create curve texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function createRGBA32UITexture(
  gl: WebGL2RenderingContext,
  data: Uint32Array,
  width: number,
  height: number
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to create band texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, width, height, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, data);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function createResources(
  gl: WebGL2RenderingContext,
  gpuData: SlugGPUData,
  fragmentSource: string
): RendererResources {
  gl.getExtension("EXT_color_buffer_float");
  const program = createProgram(gl, SLUG_VERTEX_SHADER, fragmentSource);
  const uniforms = {
    slug_matrix: gl.getUniformLocation(program, "slug_matrix"),
    slug_viewport: gl.getUniformLocation(program, "slug_viewport"),
    curveTexture: gl.getUniformLocation(program, "curveTexture"),
    bandTexture: gl.getUniformLocation(program, "bandTexture"),
  };
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  if (!vbo) throw new Error("Failed to create VBO");
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, gpuData.vertices, gl.STATIC_DRAW);
  const stride = 20 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 4 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 8 * 4);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 12 * 4);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 16 * 4);
  const ibo = gl.createBuffer();
  if (!ibo) throw new Error("Failed to create IBO");
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, gpuData.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const curveTexture = createRGBA32FTexture(
    gl,
    gpuData.curveTexture.data as Float32Array,
    gpuData.curveTexture.width,
    gpuData.curveTexture.height
  );
  const bandTexture = createRGBA32UITexture(
    gl,
    gpuData.bandTexture.data as Uint32Array,
    gpuData.bandTexture.width,
    gpuData.bandTexture.height
  );
  return {
    program,
    vao,
    vbo,
    ibo,
    curveTexture,
    bandTexture,
    uniforms,
    indexCount: gpuData.indices.length,
  };
}

function draw(
  gl: WebGL2RenderingContext,
  res: RendererResources,
  mvpMatrix: Float32Array,
  viewportWidth: number,
  viewportHeight: number
): void {
  gl.useProgram(res.program);
  gl.uniformMatrix4fv(res.uniforms.slug_matrix, false, mvpMatrix);
  gl.uniform2f(res.uniforms.slug_viewport, viewportWidth, viewportHeight);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, res.curveTexture);
  gl.uniform1i(res.uniforms.curveTexture, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, res.bandTexture);
  gl.uniform1i(res.uniforms.bandTexture, 1);
  gl.bindVertexArray(res.vao);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawElements(gl.TRIANGLES, res.indexCount, gl.UNSIGNED_SHORT, 0);
  gl.bindVertexArray(null);
}

export function createSlugWebGLRenderer(
  gl: WebGL2RenderingContext,
  options?: SlugWebGLRendererOptions
): SlugWebGLRenderer {
  let resources: RendererResources | null = null;
  const fragmentSource = options?.adaptiveSupersampling
    ? SLUG_FRAGMENT_SHADER_ADAPTIVE
    : SLUG_FRAGMENT_SHADER;

  return {
    setGeometry(data) {
      if (resources) this.dispose();
      resources = createResources(gl, data, fragmentSource);
    },
    render(mvp) {
      if (!resources) return;
      draw(gl, resources, mvp, gl.drawingBufferWidth, gl.drawingBufferHeight);
    },
    dispose() {
      if (!resources) return;
      gl.deleteTexture(resources.curveTexture);
      gl.deleteTexture(resources.bandTexture);
      gl.deleteBuffer(resources.vbo);
      gl.deleteBuffer(resources.ibo);
      gl.deleteVertexArray(resources.vao);
      gl.deleteProgram(resources.program);
      resources = null;
    },
  };
}
