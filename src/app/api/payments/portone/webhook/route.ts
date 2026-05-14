import { NextResponse } from "next/server";
import {
  PortOnePaymentError,
  syncPortOnePayment,
} from "@/lib/payments";
import {
  PortOneWebhookVerificationError,
  verifyPortOneWebhookBody,
} from "@/lib/payments/portone-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();

  try {
    const verifiedPayload = await verifyPortOneWebhookBody({
      body,
      headers: request.headers,
    });
    return await handlePortOneWebhook(verifiedPayload);
  } catch (error) {
    if (error instanceof PortOneWebhookVerificationError) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    throw error;
  }
}

async function handlePortOneWebhook(payload: unknown) {
  const paymentId = readPortOneWebhookPaymentId(payload);

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await syncPortOnePayment({
      paymentId,
      source: "webhook",
      webhook: payload,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PortOnePaymentError && error.status === 404) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    console.error(error);

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

function readPortOneWebhookPaymentId(payload: unknown) {
  const root = toRecord(payload);
  const data = toRecord(root?.data);

  return firstString(
    data?.paymentId,
    data?.payment_id,
    data?.merchantOrderRef,
    data?.merchant_order_ref,
    root?.paymentId,
    root?.payment_id,
    root?.merchantUid,
    root?.merchant_uid,
    root?.merchantOrderRef,
    root?.merchant_order_ref,
  );
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}
