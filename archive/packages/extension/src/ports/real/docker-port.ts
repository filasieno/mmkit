import { spawn } from "node:child_process";
import type { LaunchSpec, ProcessInfo } from "../../types";
import type { DockerPort } from "../types";

export class RealDockerPort implements DockerPort {
  async run(spec: LaunchSpec): Promise<ProcessInfo> {
    return new Promise((resolve, reject) => {
      const child = spawn(spec.command, spec.args, { stdio: "ignore", detached: true });
      child.unref();
      child.once("error", reject);
      child.once("spawn", () => resolve({ pid: child.pid ?? 0, command: spec.command }));
    });
  }

  async stop(containerName: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("docker", ["rm", "-f", containerName], { stdio: "ignore" });
      child.once("error", reject);
      child.once("exit", () => resolve());
    });
  }

  async isRunning(containerName: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn("docker", ["inspect", "-f", "{{.State.Running}}", containerName], { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      child.stdout.on("data", (d) => (out += d.toString()));
      child.once("exit", (code) => resolve(code === 0 && out.trim() === "true"));
      child.once("error", () => resolve(false));
    });
  }

  imageExists(image: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn("docker", ["image", "inspect", image], { stdio: "ignore" });
      child.once("exit", (code) => resolve(code === 0));
      child.once("error", () => resolve(false));
    });
  }

  pullImage(image: string, onProgress?: (message: string, fractionWithinStep: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      onProgress?.(`Pulling Docker image ${image}…`, 0);
      const child = spawn("docker", ["pull", image], { stdio: ["ignore", "pipe", "pipe"] });
      let layerTotal = 0;
      let layerDone = 0;
      child.stdout.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split(/\r?\n/)) {
          if (!line.trim()) continue;
          if (line.includes("Pulling from")) {
            onProgress?.(line.trim(), 0.05);
            continue;
          }
          if (line.includes("Pull complete") || line.includes("Already exists")) {
            layerDone += 1;
            const fraction = layerTotal > 0 ? layerDone / layerTotal : 0.5;
            onProgress?.(line.trim(), Math.min(0.95, fraction));
            continue;
          }
          if (line.includes("Downloading") || line.includes("Extracting") || line.includes("Waiting")) {
            onProgress?.(line.trim(), layerTotal > 0 ? layerDone / layerTotal : 0.25);
            continue;
          }
          if (line.includes("Pulling fs layer") || line.includes("Verifying Checksum")) {
            layerTotal += 1;
            onProgress?.(line.trim(), layerTotal > 0 ? layerDone / layerTotal : 0.1);
          }
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        const line = chunk.toString().trim();
        if (line) onProgress?.(line, layerTotal > 0 ? layerDone / layerTotal : 0.5);
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) {
          onProgress?.(`Image ${image} ready`, 1);
          resolve();
          return;
        }
        reject(new Error(`docker pull failed (${code})`));
      });
    });
  }
}
