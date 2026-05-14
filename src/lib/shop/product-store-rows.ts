import { z } from "zod";

const productKindSchema = z.enum(["regular", "one_of_a_kind"]);
const limitedTypeSchema = z
  .enum(["quantity", "period", "kiln_batch", "project"])
  .nullable();
const restockCtaTypeSchema = z
  .enum(["restock_alert", "similar_work_alert", "next_limited_alert"])
  .nullable();
const availabilityStatusSchema = z.enum([
  "available",
  "sold_out",
  "upcoming",
  "archive",
]);

export const productRowSchema = z.object({
  availability_status: availabilityStatusSchema,
  care_note: z.string().nullable(),
  category: z.string(),
  created_at: z.string(),
  currency: z.literal("KRW"),
  glaze: z.string().nullable(),
  id: z.string(),
  is_archived: z.boolean(),
  is_limited: z.boolean(),
  kind: productKindSchema,
  limited_type: limitedTypeSchema,
  made_to_order_available: z.boolean().nullish(),
  made_to_order_days_max: z.number().int().positive().nullish(),
  made_to_order_days_min: z.number().int().positive().nullish(),
  made_to_order_notice: z.string().nullable().optional(),
  material: z.string().nullable(),
  plant_care_notice: z.string().nullable().optional(),
  plant_option_enabled: z.boolean().nullish(),
  plant_option_price_delta_krw: z.number().int().nonnegative().nullish(),
  plant_return_notice: z.string().nullable().optional(),
  plant_shipping_restriction_notice: z.string().nullable().optional(),
  plant_species: z.string().nullable().optional(),
  price_krw: z.number().int().nonnegative().nullable(),
  purchase_limit_quantity: z.number().int().nonnegative().nullable().optional(),
  published: z.boolean(),
  published_at: z.string().nullable(),
  restock_cta_type: restockCtaTypeSchema,
  shipping_note: z.string().nullable(),
  short_description: z.string(),
  size: z.string().nullable(),
  slug: z.string(),
  stock_quantity: z.number().int().nonnegative().nullable(),
  story: z.string().nullable(),
  story_json: z.unknown().optional(),
  story_text: z.string().nullable().optional(),
  title_ko: z.string(),
  updated_at: z.string(),
  usage_note: z.string().nullable(),
});

export const productListRowSchema = productRowSchema.pick({
  availability_status: true,
  category: true,
  created_at: true,
  currency: true,
  id: true,
  is_archived: true,
  is_limited: true,
  kind: true,
  limited_type: true,
  made_to_order_available: true,
  made_to_order_days_max: true,
  made_to_order_days_min: true,
  made_to_order_notice: true,
  plant_care_notice: true,
  plant_option_enabled: true,
  plant_option_price_delta_krw: true,
  plant_return_notice: true,
  plant_shipping_restriction_notice: true,
  plant_species: true,
  price_krw: true,
  purchase_limit_quantity: true,
  published: true,
  published_at: true,
  restock_cta_type: true,
  short_description: true,
  slug: true,
  stock_quantity: true,
  title_ko: true,
  updated_at: true,
});

const productSlugRowSchema = z.object({
  slug: z.string(),
});

export type ProductRow = z.infer<typeof productRowSchema>;
export type ProductListRow = z.infer<typeof productListRowSchema>;
export type ProductSelectRow = ProductRow;

export function parseProductRows(data: unknown): ProductSelectRow[] {
  return z.array(productRowSchema).parse(data ?? []);
}

export function parseProductListRows(data: unknown): ProductListRow[] {
  return z.array(productListRowSchema).parse(data ?? []);
}

export function parseProductSlugRows(data: unknown) {
  return z.array(productSlugRowSchema).parse(data ?? []);
}
