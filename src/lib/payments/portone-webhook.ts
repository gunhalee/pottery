import "server-only";

import { Webhook } from "@portone/server-sdk";

export class PortOneWebhookVerificationError extends Error {
  constructor(message = "PortOne 웹훅 서명 검증에 실패했습니다.") {
    super(message);
    this.name = "PortOneWebhookVerificationError";
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
    return JSON.parse(body) as unknown;
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
