import "server-only";
import { z } from "zod";
import { getNotionEnv } from "@/lib/config/env";
import { type NotionReview, type ReviewTargetType } from "@/types";
import { notionDataSources, createApprovedFilter, getReviewsSorts } from "./schema";
import {
  getCheckboxProperty,
  getDateStartProperty,
  getNumberProperty,
  getRichTextProperty,
  getSelectProperty,
  getTitleProperty,
} from "./properties";
import { getPageMeta, notionSlugSchema, parseNotionEntity } from "./normalize";
import { queryDataSourcePages } from "./query";

const reviewSchema = z.object({
  pageId: z.string().uuid(),
  pageUrl: z.string().url(),
  createdTime: z.string(),
  lastEditedTime: z.string(),
  authorAlias: z.string().trim().min(1),
  targetType: z.enum(["class", "product"]),
  targetSlug: notionSlugSchema,
  rating: z.number().nullable(),
  body: z.string(),
  approved: z.boolean(),
  createdAt: z.string().nullable(),
});

function normalizeReview(page: Parameters<typeof getPageMeta>[0]): NotionReview {
  const properties = page.properties;
  const schema = notionDataSources.reviews.properties;

  return parseNotionEntity(
    reviewSchema,
    {
      ...getPageMeta(page),
      authorAlias: getTitleProperty(properties, schema.authorAlias),
      targetType: getSelectProperty(properties, schema.targetType),
      targetSlug: getRichTextProperty(properties, schema.targetSlug),
      rating: getNumberProperty(properties, schema.rating),
      body: getRichTextProperty(properties, schema.body),
      approved: getCheckboxProperty(properties, schema.approved),
      createdAt: getDateStartProperty(properties, schema.createdAt),
    },
    `review page ${page.id}`,
  );
}

export async function getApprovedReviews(input?: {
  targetType?: ReviewTargetType;
  targetSlug?: string;
}) {
  const env = getNotionEnv();
  const schema = notionDataSources.reviews.properties;
  const filter =
    input?.targetType && input?.targetSlug
      ? {
          and: [
            createApprovedFilter(schema.approved),
            {
              property: schema.targetType,
              select: {
                equals: input.targetType,
              },
            },
            {
              property: schema.targetSlug,
              rich_text: {
                equals: input.targetSlug,
              },
            },
          ],
        }
      : input?.targetType
        ? {
            and: [
              createApprovedFilter(schema.approved),
              {
                property: schema.targetType,
                select: {
                  equals: input.targetType,
                },
              },
            ],
          }
        : input?.targetSlug
          ? {
              and: [
                createApprovedFilter(schema.approved),
                {
                  property: schema.targetSlug,
                  rich_text: {
                    equals: input.targetSlug,
                  },
                },
              ],
            }
          : createApprovedFilter(schema.approved);

  const pages = await queryDataSourcePages({
    data_source_id: env.reviewsDataSourceId,
    filter,
    sorts: getReviewsSorts(),
  });

  return pages.map(normalizeReview);
}
