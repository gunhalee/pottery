import { rm } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const target = path.resolve(workspace, ".next");
const relative = path.relative(workspace, target);

if (relative.startsWith("..") || path.isAbsolute(relative)) {
  throw new Error(`Refusing to remove path outside workspace: ${target}`);
}

await rm(target, { force: true, recursive: true });
console.log(`Cleaned ${target}`);
