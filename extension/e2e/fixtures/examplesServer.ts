import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));
export const examplesDir = path.join(fixturesDir, "..", "..", "..", "examples");

const EXAMPLES_SERVER_PORT = 8765;
const EXAMPLES_SERVER_HOST = "127.0.0.1";

let server: http.Server | undefined;

function resolveExamplesFilePath(urlPath: string): string | null {
  const normalized = urlPath.split("?")[0] ?? "/";
  const relativePath =
    normalized === "/" ? "sample-alert.html" : normalized.replace(/^\//, "");
  const resolved = path.resolve(examplesDir, relativePath);
  if (!resolved.startsWith(path.resolve(examplesDir))) {
    return null;
  }
  return resolved;
}

function contentTypeForFile(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".txt")) {
    return "text/plain; charset=utf-8";
  }
  return "application/octet-stream";
}

export async function startExamplesServer(): Promise<string> {
  if (server) {
    return `http://${EXAMPLES_SERVER_HOST}:${EXAMPLES_SERVER_PORT}`;
  }

  server = http.createServer((request, response) => {
    const filePath = resolveExamplesFilePath(request.url ?? "/");
    if (!filePath) {
      response.writeHead(403);
      response.end();
      return;
    }

    try {
      const body = fs.readFileSync(filePath);
      response.writeHead(200, {
        "Content-Type": contentTypeForFile(filePath),
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(EXAMPLES_SERVER_PORT, EXAMPLES_SERVER_HOST, () => {
      resolve();
    });
  });

  return `http://${EXAMPLES_SERVER_HOST}:${EXAMPLES_SERVER_PORT}`;
}

export async function stopExamplesServer(): Promise<void> {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server!.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  server = undefined;
}
