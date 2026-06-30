import { Buffer } from "node:buffer";
import net from "node:net";

type RdpAddon = {
  id: string;
  manifestURL?: string;
};

type RdpMessage = {
  addonsActor?: string;
  addon?: RdpAddon;
  addons?: RdpAddon[];
  error?: unknown;
};

export type FirefoxAddonInstall = {
  addonId: string;
  pageId: string;
};

function parseMozillaExtensionPageId(manifestUrl?: string): string | null {
  const match = manifestUrl?.match(/^moz-extension:\/\/([^/]+)\//);
  return match?.[1] ?? null;
}

function resolvePageId(addon: RdpAddon): string | null {
  const fromManifest = parseMozillaExtensionPageId(addon.manifestURL);
  if (fromManifest) {
    return fromManifest;
  }
  if (!addon.id.includes("@")) {
    return addon.id;
  }
  return null;
}

export function installFirefoxTemporaryAddon(
  port: number,
  host: string,
  addonPath: string
): Promise<FirefoxAddonInstall> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host });
    let installedAddonId: string | null = null;

    let settled = false;
    const finish = (error?: Error, install?: FirefoxAddonInstall) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
        return;
      }
      if (!install) {
        reject(new Error("Firefox RDP installTemporaryAddon did not return add-on metadata"));
        return;
      }
      resolve(install);
    };

    socket.once("error", (error) => finish(error));
    socket.once("close", () => {
      if (!settled) {
        finish(new Error("Firefox RDP connection closed before add-on installation completed"));
      }
    });

    const send = (data: Record<string, string>) => {
      const raw = Buffer.from(JSON.stringify(data));
      socket.write(`${raw.length}`);
      socket.write(":");
      socket.write(raw);
    };

    send({
      to: "root",
      type: "getRoot",
    });

    const completeInstall = (addon: RdpAddon) => {
      const pageId = resolvePageId(addon);
      if (pageId) {
        socket.end();
        finish(undefined, { addonId: addon.id, pageId });
        return;
      }
      installedAddonId = addon.id;
      send({ to: "root", type: "listAddons" });
    };

    const onMessage = (message: RdpMessage) => {
      if (message.addonsActor) {
        send({
          to: message.addonsActor,
          type: "installTemporaryAddon",
          addonPath,
        });
      }

      if (message.addon?.id) {
        completeInstall(message.addon);
      }

      if (message.addons && installedAddonId) {
        const listed = message.addons.find((entry) => entry.id === installedAddonId);
        if (!listed) {
          socket.end();
          finish(
            new Error(
              `Firefox RDP listAddons did not include installed add-on ${installedAddonId}`
            )
          );
          return;
        }
        const pageId = resolvePageId(listed);
        if (!pageId) {
          socket.end();
          finish(
            new Error(
              `Firefox RDP add-on ${installedAddonId} did not expose a moz-extension page id`
            )
          );
          return;
        }
        socket.end();
        finish(undefined, { addonId: listed.id, pageId });
      }

      if (message.error) {
        socket.end();
        finish(new Error(`Firefox RDP error: ${JSON.stringify(message.error)}`));
      }
    };

    const buffers: Buffer[] = [];
    let remainingBytes = 0;

    socket.on("data", (chunk) => {
      let data = chunk;

      while (true) {
        if (remainingBytes === 0) {
          const index = data.indexOf(":".charCodeAt(0));
          buffers.push(data);

          if (index === -1) {
            return;
          }

          const buffer = Buffer.concat(buffers);
          const bufferIndex = buffer.indexOf(":".charCodeAt(0));
          buffers.length = 0;
          remainingBytes = Number(buffer.subarray(0, bufferIndex).toString());

          if (!Number.isFinite(remainingBytes)) {
            finish(new Error("Invalid Firefox RDP message length"));
            socket.end();
            return;
          }

          data = buffer.subarray(bufferIndex + 1);
        }

        if (data.length < remainingBytes) {
          remainingBytes -= data.length;
          buffers.push(data);
          return;
        }

        buffers.push(data.subarray(0, remainingBytes));
        const buffer = Buffer.concat(buffers);
        buffers.length = 0;

        const json = JSON.parse(buffer.toString()) as RdpMessage;
        queueMicrotask(() => {
          onMessage(json);
        });

        const remainder = data.subarray(remainingBytes);
        remainingBytes = 0;

        if (remainder.length === 0) {
          return;
        }

        data = remainder;
      }
    });
  });
}

export function findFreeTcpPort(host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to resolve a free TCP port"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

export async function waitForFirefoxRdp(
  port: number,
  host: string,
  maxAttempts = 250,
  retryIntervalMs = 120
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect({ port, host });
        socket.once("connect", () => {
          socket.end();
          resolve();
        });
        socket.once("error", reject);
      });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        setTimeout(resolve, retryIntervalMs);
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Firefox RDP debugger did not become reachable");
}
