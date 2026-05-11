"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/auth";
import { updateAdminOrderFulfillment } from "@/lib/admin/orders";

const fulfillmentUpdateSchema = z.object({
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

export async function updateAdminOrderFulfillmentAction(formData: FormData) {
  await assertAdmin();

  const parsed = fulfillmentUpdateSchema.parse({
    carrier: formData.get("carrier"),
    fulfillmentStatus: formData.get("fulfillmentStatus"),
    note: formData.get("note"),
    orderId: formData.get("orderId"),
    trackingNumber: formData.get("trackingNumber"),
    trackingUrl: formData.get("trackingUrl"),
  });

  try {
    await updateAdminOrderFulfillment({
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

function nullableString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
