import "server-only";
import type { PageObjectResponse } from "@notionhq/client";
import { z } from "zod";

export const notionSlugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/);

export const nullableUrlSchema = z.string().url().nullable();

export function getPageMeta(page: PageObjectResponse) {
  return {
    pageId: page.id,
    pageUrl: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export function parseNotionEntity<T>(
  schema: z.ZodType<T>,
  input: unknown,
  context: string,
) {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    throw new Error(`Invalid Notion ${context}. ${issues}`);
  }

  return parsed.data;
}
