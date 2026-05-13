import { z } from "zod";

const contentKindSchema = z.enum(["gallery", "news"]);
const contentStatusSchema = z.enum(["draft", "published"]);

export const contentEntryRowSchema = z.object({
  body_json: z.unknown(),
  body_text: z.string(),
  created_at: z.string(),
  display_date: z.string().nullable(),
  id: z.string(),
  kind: contentKindSchema,
  published_at: z.string().nullable(),
  related_product_slug: z.string().nullable(),
  slug: z.string(),
  status: contentStatusSchema,
  summary: z.string(),
  title: z.string(),
  updated_at: z.string(),
});

export const contentEntryListRowSchema = contentEntryRowSchema.omit({
  body_json: true,
});

const contentSlugRowSchema = z.object({
  slug: z.string(),
});

export type ContentEntryRow = z.infer<typeof contentEntryRowSchema>;
export type ContentEntryListRow = z.infer<typeof contentEntryListRowSchema>;

export function parseContentEntryRows(data: unknown): ContentEntryRow[] {
  return z.array(contentEntryRowSchema).parse(data ?? []);
}

export function parseContentEntryListRows(data: unknown): ContentEntryListRow[] {
  return z.array(contentEntryListRowSchema).parse(data ?? []);
}

export function parseContentSlugRows(data: unknown) {
  return z.array(contentSlugRowSchema).parse(data ?? []);
}
