import "server-only";

import { Webhook } from "@portone/server-sdk";

export class PortOneWebhookVerificationError extends Error {
  constructor(message = "PortOne webhook signature verification failed.") {
    super(message);
    this.name = "PortOneWebhookVerificationError";
  }
}

export class PortOneWebhookConfigurationError extends Error {
  constructor(message = "PORTONE_WEBHOOK_SECRET is required.") {
    super(message);
    this.name = "PortOneWebhookConfigurationError";
  }
}

export async function verifyPortOneWebhookBody({
  body,
  headers,
}: {
  body: string;
  headers: Headers;
}) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new PortOneWebhookConfigurationError();
  }

  try {
    return await Webhook.verify(secret, body, {
      "webhook-id": headers.get("webhook-id") ?? undefined,
      "webhook-signature": headers.get("webhook-signature") ?? undefined,
      "webhook-timestamp": headers.get("webhook-timestamp") ?? undefined,
    });
  } catch (error) {
    if (error instanceof Webhook.WebhookVerificationError) {
      throw new PortOneWebhookVerificationError(error.message);
    }

    throw error;
  }
}
