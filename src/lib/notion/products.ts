import "server-only";
import { z } from "zod";
import { getNotionEnv } from "@/lib/config/env";
import {
  inventoryStatuses,
  productCategories,
  publishStatuses,
  type NotionProduct,
  type ProductCategory,
} from "@/types";
import { notionDataSources, createPublishedFilter, getLastEditedSorts } from "./schema";
import {
  getCheckboxProperty,
  getFilesPropertyFirstUrl,
  getRichTextProperty,
  getSelectProperty,
  getTitleProperty,
  getUrlProperty,
} from "./properties";
import { getPageMeta, notionSlugSchema, nullableUrlSchema, parseNotionEntity } from "./normalize";
import { queryDataSourcePages, queryFirstDataSourcePage } from "./query";

const productSchema = z.object({
  pageId: z.string().uuid(),
  pageUrl: z.string().url(),
  createdTime: z.string(),
  lastEditedTime: z.string(),
  title: z.string().trim().min(1),
  slug: notionSlugSchema,
  category: z.enum(productCategories),
  priceLabel: z.string(),
  summary: z.string(),
  description: z.string(),
  inventoryStatus: z.enum(inventoryStatuses),
  purchaseUrl: z.string().url().nullable(),
  isPremium: z.boolean(),
  isCustom: z.boolean(),
  thumbnailUrl: nullableUrlSchema,
  status: z.enum(publishStatuses),
});

function normalizeProduct(
  page: Parameters<typeof getPageMeta>[0],
): NotionProduct {
  const properties = page.properties;
  const schema = notionDataSources.products.properties;

  return parseNotionEntity(
    productSchema,
    {
      ...getPageMeta(page),
      title: getTitleProperty(properties, schema.title),
      slug: getRichTextProperty(properties, schema.slug),
      category: getSelectProperty(properties, schema.category),
      priceLabel: getRichTextProperty(properties, schema.priceLabel),
      summary: getRichTextProperty(properties, schema.summary),
      description: getRichTextProperty(properties, schema.description),
      inventoryStatus: getSelectProperty(properties, schema.inventoryStatus),
      purchaseUrl: getUrlProperty(properties, schema.purchaseUrl),
      isPremium: getCheckboxProperty(properties, schema.isPremium),
      isCustom: getCheckboxProperty(properties, schema.isCustom),
      thumbnailUrl: getFilesPropertyFirstUrl(properties, schema.thumbnail),
      status: getSelectProperty(properties, schema.status),
    },
    `product page ${page.id}`,
  );
}

export async function getPublishedProducts(input?: { category?: ProductCategory }) {
  const env = getNotionEnv();
  const schema = notionDataSources.products.properties;
  const filter = input?.category
    ? {
        and: [
          createPublishedFilter(schema.status),
          {
            property: schema.category,
            select: {
              equals: input.category,
            },
          },
        ],
      }
    : createPublishedFilter(schema.status);

  const pages = await queryDataSourcePages({
    data_source_id: env.productsDataSourceId,
    filter,
    sorts: getLastEditedSorts(),
  });

  return pages.map(normalizeProduct);
}

export async function getProductBySlug(slug: string) {
  const env = getNotionEnv();
  const schema = notionDataSources.products.properties;

  const page = await queryFirstDataSourcePage({
    data_source_id: env.productsDataSourceId,
    filter: {
      and: [
        createPublishedFilter(schema.status),
        {
          property: schema.slug,
          rich_text: {
            equals: slug,
          },
        },
      ],
    },
  });

  return page ? normalizeProduct(page) : null;
}
