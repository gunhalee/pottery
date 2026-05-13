import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const nextCli = "node_modules/next/dist/bin/next";
const adminCookieName = "consepot_admin_session";

export function startNextServer(port, env = process.env) {
  const baseUrl = `http://localhost:${port}`;
  const server = spawn(process.execPath, [nextCli, "start", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";

  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });

  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return {
    baseUrl,
    getOutput: () => output,
    server,
    stop() {
      server.kill();
    },
    wait: () => waitForServer(baseUrl, server, () => output),
  };
}

export async function waitForServer(baseUrl, server, getOutput) {
  const startedAt = Date.now();
  const timeoutMs = 20_000;

  while (Date.now() - startedAt < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited early:\n${getOutput()}`);
    }

    try {
      const response = await fetch(baseUrl, { redirect: "manual" });

      if (response.status < 500) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${baseUrl}:\n${getOutput()}`);
}

export function createAdminSessionCookie(envValues) {
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `admin.${expiresAt}`;
  return `${payload}.${sign(payload, getAdminSessionSecret(envValues))}`;
}

export function getAdminCookieHeader(envValues) {
  return `${adminCookieName}=${createAdminSessionCookie(envValues)}`;
}

export function loadLocalEnv() {
  const envValues = {};

  for (const path of [".env.local", ".env"]) {
    try {
      Object.assign(envValues, parseEnvFile(readFileSync(path, "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return envValues;
}

export function assertIncludes(html, expected, label) {
  assert(html.includes(expected), `Missing ${label}: ${expected}`);
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function getAdminSessionSecret(envValues) {
  return (
    envValues.ADMIN_SESSION_SECRET ||
    envValues.ADMIN_PASSWORD ||
    envValues.ADMIN_PASSWORD_SHA256 ||
    "consepot-local-unconfigured-admin-secret"
  );
}

function parseEnvFile(source) {
  const values = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = unquote(value);
  }

  return values;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
