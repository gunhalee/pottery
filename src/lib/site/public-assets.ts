import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

export function getOptionalPublicAsset(publicPath: string) {
  const normalizedPath = normalizePublicPath(publicPath);
  const absolutePath = join(
    process.cwd(),
    "public",
    ...normalizedPath.slice(1).split("/"),
  );

  return existsSync(absolutePath) ? normalizedPath : null;
}

function normalizePublicPath(publicPath: string) {
  const normalizedPath = publicPath.replaceAll("\\", "/");

  if (!normalizedPath.startsWith("/") || normalizedPath.includes("..")) {
    throw new Error(`Invalid public asset path: ${publicPath}`);
  }

  return normalizedPath;
}
