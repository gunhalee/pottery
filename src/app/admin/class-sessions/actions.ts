"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin/auth";
import {
  createClassSession,
  updateClassSession,
} from "@/lib/shop/class-sessions";

const classSessionStatusSchema = z.enum(["draft", "published", "archived"]);
const classSessionPayloadSchema = z.object({
  dateLabel: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1200).optional(),
  sessionDate: z.string().trim().optional(),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .or(z.literal("")),
  status: classSessionStatusSchema,
  title: z.string().trim().min(1).max(80),
});
const classSessionUpdateSchema = classSessionPayloadSchema.extend({
  id: z.uuid(),
});

export async function createClassSessionAction(formData: FormData) {
  await assertAdmin();

  const parsed = classSessionPayloadSchema.parse(readClassSessionForm(formData));

  try {
    await createClassSession(parsed);
    revalidatePath("/admin/class-sessions");
    revalidatePath("/admin/reviews");
    revalidatePath("/class");
  } catch (error) {
    console.error(error);
    redirect("/admin/class-sessions?error=create");
  }

  redirect("/admin/class-sessions?saved=1");
}

export async function updateClassSessionAction(formData: FormData) {
  await assertAdmin();

  const parsed = classSessionUpdateSchema.parse({
    ...readClassSessionForm(formData),
    id: formData.get("id"),
  });

  try {
    await updateClassSession({
      id: parsed.id,
      input: parsed,
    });
    revalidatePath("/admin/class-sessions");
    revalidatePath("/admin/reviews");
    revalidatePath("/class");
  } catch (error) {
    console.error(error);
    redirect("/admin/class-sessions?error=update");
  }

  redirect("/admin/class-sessions?saved=1");
}

function readClassSessionForm(formData: FormData) {
  return {
    dateLabel: readString(formData, "dateLabel"),
    description: readString(formData, "description"),
    sessionDate: readString(formData, "sessionDate"),
    slug: readString(formData, "slug"),
    status: readString(formData, "status"),
    title: readString(formData, "title"),
  };
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
