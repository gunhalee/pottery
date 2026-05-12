import { NextResponse } from "next/server";
import {
  PortOnePaymentError,
  syncPortOnePayment,
} from "@/lib/payments";
import {
  PortOneWebhookVerificationError,
  verifyPortOneWebhookBody,
} from "@/lib/payments/portone-webhook";

type PortOneWebhookPayload = {
  data?: {
    paymentId?: unknown;
  };
  type?: unknown;
};

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
  const portOnePayload = payload as PortOneWebhookPayload;
  const paymentId =
    typeof portOnePayload.data?.paymentId === "string"
      ? portOnePayload.data.paymentId
      : null;

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await syncPortOnePayment({
      paymentId,
      source: "webhook",
      webhook: portOnePayload,
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
