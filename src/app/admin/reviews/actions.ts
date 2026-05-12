"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/auth";
import { updateAdminProductFeedbackStatus } from "@/lib/admin/product-feedback";

const reviewStatusUpdateSchema = z.object({
  feedbackId: z.uuid(),
  status: z.enum(["pending", "published", "hidden"]),
});

export async function updateAdminProductFeedbackStatusAction(
  formData: FormData,
) {
  await assertAdmin();

  const parsed = reviewStatusUpdateSchema.parse({
    feedbackId: formData.get("feedbackId"),
    status: formData.get("status"),
  });

  try {
    const result = await updateAdminProductFeedbackStatus(parsed);

    revalidatePath("/admin/reviews");

    if (result.productSlug) {
      revalidatePath(`/shop/${result.productSlug}`);
    }
  } catch (error) {
    console.error(error);
    redirect("/admin/reviews?error=save");
  }

  redirect("/admin/reviews?saved=1");
}
