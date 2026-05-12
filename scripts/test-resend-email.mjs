import { readFileSync, existsSync } from "node:fs";

const env = {
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...process.env,
};

const apiKey = env.RESEND_API_KEY?.trim();
const from = env.RESEND_FROM_EMAIL?.trim();
const to = env.ADMIN_NOTIFICATION_EMAIL?.trim() || env.RESEND_REPLY_TO_EMAIL?.trim();
const replyTo = env.RESEND_REPLY_TO_EMAIL?.trim();

const missingKeys = [
  apiKey ? null : "RESEND_API_KEY",
  from ? null : "RESEND_FROM_EMAIL",
  to ? null : "ADMIN_NOTIFICATION_EMAIL or RESEND_REPLY_TO_EMAIL",
].filter(Boolean);

if (missingKeys.length > 0) {
  console.error(`Missing required email env: ${missingKeys.join(", ")}.`);
  process.exit(1);
}

const response = await fetch("https://api.resend.com/emails", {
  body: JSON.stringify({
    from,
    html: "<p>Consepot Resend test email succeeded.</p>",
    reply_to: replyTo || undefined,
    subject: "Consepot Resend test",
    text: "Consepot Resend test email succeeded.",
    to,
  }),
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  method: "POST",
});

const result = await response.json().catch(async () => ({
  message: await response.text(),
}));

if (!response.ok) {
  console.error(`Resend test failed (${response.status}):`, result);
  process.exit(1);
}

console.log("Resend test sent:", result.id ?? result);

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        const key = index === -1 ? line : line.slice(0, index).trim();
        const value = index === -1 ? "" : line.slice(index + 1).trim();

        return [key, stripQuotes(value)];
      }),
  );
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
