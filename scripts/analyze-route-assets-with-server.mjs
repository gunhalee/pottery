#!/usr/bin/env node

import { spawn } from "node:child_process";
import { startNextServer } from "./smoke-lib.mjs";

const port = Number(process.env.PERF_PORT ?? 3002);
const app = startNextServer(port);

try {
  await app.wait();
  const exitCode = await runAnalyzer(app.baseUrl, process.argv.slice(2));
  process.exitCode = exitCode;
} finally {
  app.stop();
}

function runAnalyzer(baseUrl, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/analyze-route-assets.mjs", "--base", baseUrl, ...args],
      {
        env: process.env,
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
