import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));

export const extensionDistPath = path.join(e2eDir, "..", "dist");
