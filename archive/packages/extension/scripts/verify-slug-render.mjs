/**
 * Headless browser check: Slug Hello World must produce bright pixels in the canvas center.
 */
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webviewDir = path.join(__dirname, "../out/node-editor-webview");
const testHtml = path.join(webviewDir, "test.html");

if (!fs.existsSync(testHtml)) {
  throw new Error(`missing ${testHtml} — run npm run build -w mmkit first`);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".js")) return "text/javascript";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".wasm")) return "application/wasm";
  if (filePath.endsWith(".woff")) return "font/woff";
  return "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? "/test.html").split("?")[0]);
  const rel = urlPath === "/" ? "/test.html" : urlPath;
  const filePath = path.join(webviewDir, rel);
  if (!filePath.startsWith(webviewDir) || !fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
});
const port = server.address().port;
const url = `http://127.0.0.1:${port}/test.html`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const screenshotPath = path.join(webviewDir, "slug-hello-world.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const result = await page.evaluate(() => {
    const status = document.getElementById("status")?.textContent ?? "";
    const canvas = document.getElementById("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { ok: false, reason: "canvas missing", status };
    }
    const gl = canvas.getContext("webgl2");
    if (!gl) return { ok: false, reason: "webgl2 missing", status };

    const buf = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let bright = 0;
    for (let i = 0; i < buf.length; i += 4) {
      bright += buf[i] + buf[i + 1] + buf[i + 2];
    }
    return { ok: bright > 500_000, bright, status, width: canvas.width, height: canvas.height };
  });

  if (!result.ok) {
    throw new Error(
      `Slug Hello World render check failed: ${result.reason ?? `bright=${result.bright}`} status="${result.status}" screenshot=${screenshotPath}`
    );
  }
  console.log(`Slug Hello World render OK (bright=${result.bright}, ${result.width}x${result.height})`);
  console.log(`Screenshot: ${screenshotPath}`);
} finally {
  await browser.close();
  server.close();
}
