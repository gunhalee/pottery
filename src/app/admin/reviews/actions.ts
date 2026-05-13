"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/auth";
import {
  revokeAdminClassReviewConsent,
  updateAdminClassReviewStatus,
} from "@/lib/admin/class-reviews";
import { updateAdminProductFeedbackStatus } from "@/lib/admin/product-feedback";

const reviewStatusUpdateSchema = z.object({
  feedbackId: z.uuid(),
  status: z.enum(["pending", "published", "hidden"]),
});
const classReviewStatusUpdateSchema = z.object({
  reviewId: z.uuid(),
  status: z.enum(["pending", "published", "hidden"]),
});
const classReviewRevokeSchema = z.object({
  reviewId: z.uuid(),
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

export async function updateAdminClassReviewStatusAction(formData: FormData) {
  await assertAdmin();

  const parsed = classReviewStatusUpdateSchema.parse({
    reviewId: formData.get("reviewId"),
    status: formData.get("status"),
  });

  try {
    await updateAdminClassReviewStatus(parsed);

    revalidatePath("/admin/reviews");
    revalidatePath("/class");
  } catch (error) {
    console.error(error);
    redirect("/admin/reviews?error=class-save");
  }

  redirect("/admin/reviews?saved=1");
}

export async function revokeAdminClassReviewConsentAction(formData: FormData) {
  await assertAdmin();

  const parsed = classReviewRevokeSchema.parse({
    reviewId: formData.get("reviewId"),
  });

  try {
    await revokeAdminClassReviewConsent(parsed.reviewId);

    revalidatePath("/admin/reviews");
  } catch (error) {
    console.error(error);
    redirect("/admin/reviews?error=class-revoke");
  }

  redirect("/admin/reviews?saved=1");
}
