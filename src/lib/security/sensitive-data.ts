import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const algorithm = "aes-256-gcm";
const keyLength = 32;

export function encryptSensitiveText(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSensitiveText(payload: string | null | undefined) {
  if (!payload) {
    return null;
  }

  const [version, iv, tag, encrypted] = payload.split(":");

  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Unsupported encrypted sensitive payload.");
  }

  const decipher = createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskAccountNumber(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length <= 4) {
    return digits ? `****${digits}` : "";
  }

  return `${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskCashReceiptIdentifier(value: string) {
  const normalized = value.replace(/\s/g, "");

  if (normalized.length <= 4) {
    return normalized ? `****${normalized}` : "";
  }

  return `${"*".repeat(Math.max(4, normalized.length - 4))}${normalized.slice(
    -4,
  )}`;
}

export function hashSensitiveLookup(value: string) {
  const normalized = value.replace(/\s/g, "");

  if (!normalized) {
    return null;
  }

  return createHash("sha256")
    .update(normalized)
    .update(getEncryptionKey())
    .digest("hex");
}

function getEncryptionKey() {
  const raw = process.env.SENSITIVE_DATA_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new Error("SENSITIVE_DATA_ENCRYPTION_KEY is required.");
  }

  const key = parseKey(raw);

  if (key.length !== keyLength) {
    throw new Error("SENSITIVE_DATA_ENCRYPTION_KEY must be 32 bytes.");
  }

  return key;
}

function parseKey(raw: string) {
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    return Buffer.from(raw, "base64");
  } catch {
    return Buffer.from(raw);
  }
}
