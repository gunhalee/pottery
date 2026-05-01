import "server-only";
import { z } from "zod";
import { getNotionEnv } from "@/lib/config/env";
import { classTypes, publishStatuses, type NotionClass } from "@/types";
import { notionDataSources, createPublishedFilter, getLastEditedSorts } from "./schema";
import {
  getFilesPropertyFirstUrl,
  getNumberProperty,
  getRichTextProperty,
  getSelectProperty,
  getTitleProperty,
  getUrlProperty,
} from "./properties";
import { getPageMeta, notionSlugSchema, nullableUrlSchema, parseNotionEntity } from "./normalize";
import { queryDataSourcePages, queryFirstDataSourcePage } from "./query";

const classSchema = z.object({
  pageId: z.string().uuid(),
  pageUrl: z.string().url(),
  createdTime: z.string(),
  lastEditedTime: z.string(),
  title: z.string().trim().min(1),
  slug: notionSlugSchema,
  type: z.enum(classTypes),
  summary: z.string(),
  description: z.string(),
  durationMinutes: z.number().nullable(),
  basePrice: z.number().nullable(),
  capacityDefault: z.number().nullable(),
  thumbnailUrl: nullableUrlSchema,
  naverReservationUrl: z.string().url().nullable(),
  status: z.enum(publishStatuses),
});

function normalizeClass(page: Parameters<typeof getPageMeta>[0]): NotionClass {
  const properties = page.properties;
  const schema = notionDataSources.classes.properties;

  return parseNotionEntity(
    classSchema,
    {
      ...getPageMeta(page),
      title: getTitleProperty(properties, schema.title),
      slug: getRichTextProperty(properties, schema.slug),
      type: getSelectProperty(properties, schema.type),
      summary: getRichTextProperty(properties, schema.summary),
      description: getRichTextProperty(properties, schema.description),
      durationMinutes: getNumberProperty(properties, schema.durationMinutes),
      basePrice: getNumberProperty(properties, schema.basePrice),
      capacityDefault: getNumberProperty(properties, schema.capacityDefault),
      thumbnailUrl: getFilesPropertyFirstUrl(properties, schema.thumbnail),
      naverReservationUrl: getUrlProperty(properties, schema.naverReservationUrl),
      status: getSelectProperty(properties, schema.status),
    },
    `class page ${page.id}`,
  );
}

export async function getPublishedClasses() {
  const env = getNotionEnv();
  const schema = notionDataSources.classes.properties;

  const pages = await queryDataSourcePages({
    data_source_id: env.classesDataSourceId,
    filter: createPublishedFilter(schema.status),
    sorts: getLastEditedSorts(),
  });

  return pages.map(normalizeClass);
}

export async function getClassBySlug(slug: string) {
  const env = getNotionEnv();
  const schema = notionDataSources.classes.properties;

  const page = await queryFirstDataSourcePage({
    data_source_id: env.classesDataSourceId,
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

  return page ? normalizeClass(page) : null;
}
