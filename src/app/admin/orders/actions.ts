"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/auth";
import {
  syncAdminPortOnePayment,
  updateAdminOrderFulfillment,
  updateAdminRefundAccount,
} from "@/lib/admin/orders";

const fulfillmentUpdateSchema = z.object({
  allowBackwardFulfillment: z.boolean(),
  carrier: z.string().trim().max(60).optional(),
  fulfillmentStatus: z.enum([
    "unfulfilled",
    "pickup_ready",
    "picked_up",
    "preparing",
    "shipped",
    "delivered",
    "returned",
    "canceled",
  ]),
  note: z.string().trim().max(240).optional(),
  orderId: z.uuid(),
  trackingNumber: z.string().trim().max(80).optional(),
  trackingUrl: z.url().max(240).optional().or(z.literal("")),
});

const portOnePaymentSyncSchema = z.object({
  orderId: z.uuid(),
});

const refundAccountUpdateSchema = z.object({
  adminNote: z.string().trim().max(240).optional(),
  orderId: z.uuid(),
  refundAccountId: z.uuid(),
  status: z.enum(["needs_review", "confirmed", "refunded", "rejected"]),
});

export async function updateAdminOrderFulfillmentAction(formData: FormData) {
  await assertAdmin();

  const parsed = fulfillmentUpdateSchema.parse({
    allowBackwardFulfillment: formData.get("allowBackwardFulfillment") === "1",
    carrier: optionalFormString(formData.get("carrier")),
    fulfillmentStatus: formData.get("fulfillmentStatus"),
    note: optionalFormString(formData.get("note")),
    orderId: formData.get("orderId"),
    trackingNumber: optionalFormString(formData.get("trackingNumber")),
    trackingUrl: optionalFormString(formData.get("trackingUrl")),
  });

  try {
    await updateAdminOrderFulfillment({
      allowBackwardFulfillment: parsed.allowBackwardFulfillment,
      carrier: nullableString(parsed.carrier),
      fulfillmentStatus: parsed.fulfillmentStatus,
      note: nullableString(parsed.note),
      orderId: parsed.orderId,
      trackingNumber: nullableString(parsed.trackingNumber),
      trackingUrl: nullableString(parsed.trackingUrl),
    });
  } catch (error) {
    console.error(error);
    redirect(`/admin/orders/${parsed.orderId}?error=save`);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.orderId}`);
  redirect(`/admin/orders/${parsed.orderId}?saved=1`);
}

export async function syncAdminPortOnePaymentAction(formData: FormData) {
  await assertAdmin();

  const parsed = portOnePaymentSyncSchema.parse({
    orderId: formData.get("orderId"),
  });

  try {
    await syncAdminPortOnePayment(parsed.orderId);
  } catch (error) {
    console.error(error);
    redirect(`/admin/orders/${parsed.orderId}?error=payment-sync`);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.orderId}`);
  redirect(`/admin/orders/${parsed.orderId}?saved=payment-sync`);
}

export async function updateAdminRefundAccountAction(formData: FormData) {
  await assertAdmin();

  const parsed = refundAccountUpdateSchema.parse({
    adminNote: optionalFormString(formData.get("adminNote")),
    orderId: formData.get("orderId"),
    refundAccountId: formData.get("refundAccountId"),
    status: formData.get("status"),
  });

  try {
    await updateAdminRefundAccount({
      adminNote: nullableString(parsed.adminNote),
      orderId: parsed.orderId,
      refundAccountId: parsed.refundAccountId,
      status: parsed.status,
    });
  } catch (error) {
    console.error(error);
    redirect(`/admin/orders/${parsed.orderId}?error=refund`);
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.orderId}`);
  redirect(`/admin/orders/${parsed.orderId}?saved=refund`);
}

function nullableString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}
