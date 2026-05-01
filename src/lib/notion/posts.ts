import "server-only";
import { z } from "zod";
import { getNotionEnv } from "@/lib/config/env";
import { postTags, publishStatuses, type NotionPost, type PostTag } from "@/types";
import { notionDataSources, createPublishedFilter, getPostsSorts } from "./schema";
import {
  getDateStartProperty,
  getFilesPropertyFirstUrl,
  getMultiSelectProperty,
  getRichTextProperty,
  getSelectProperty,
  getTitleProperty,
} from "./properties";
import { getPageMeta, notionSlugSchema, nullableUrlSchema, parseNotionEntity } from "./normalize";
import { queryDataSourcePages, queryFirstDataSourcePage } from "./query";

const postSchema = z.object({
  pageId: z.string().uuid(),
  pageUrl: z.string().url(),
  createdTime: z.string(),
  lastEditedTime: z.string(),
  title: z.string().trim().min(1),
  slug: notionSlugSchema,
  excerpt: z.string(),
  coverImageUrl: nullableUrlSchema,
  tags: z.array(z.enum(postTags)),
  publishedAt: z.string().nullable(),
  status: z.enum(publishStatuses),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
});

function normalizePost(page: Parameters<typeof getPageMeta>[0]): NotionPost {
  const properties = page.properties;
  const schema = notionDataSources.posts.properties;

  return parseNotionEntity(
    postSchema,
    {
      ...getPageMeta(page),
      title: getTitleProperty(properties, schema.title),
      slug: getRichTextProperty(properties, schema.slug),
      excerpt: getRichTextProperty(properties, schema.excerpt),
      coverImageUrl: getFilesPropertyFirstUrl(properties, schema.coverImage),
      tags: getMultiSelectProperty(properties, schema.tags),
      publishedAt: getDateStartProperty(properties, schema.publishedAt),
      status: getSelectProperty(properties, schema.status),
      seoTitle: getRichTextProperty(properties, schema.seoTitle) || null,
      seoDescription: getRichTextProperty(properties, schema.seoDescription) || null,
    },
    `post page ${page.id}`,
  );
}

export async function getPublishedPosts(input?: { tag?: PostTag }) {
  const env = getNotionEnv();
  const schema = notionDataSources.posts.properties;
  const filter = input?.tag
    ? {
        and: [
          createPublishedFilter(schema.status),
          {
            property: schema.tags,
            multi_select: {
              contains: input.tag,
            },
          },
        ],
      }
    : createPublishedFilter(schema.status);

  const pages = await queryDataSourcePages({
    data_source_id: env.postsDataSourceId,
    filter,
    sorts: getPostsSorts(),
  });

  return pages.map(normalizePost);
}

export async function getPostBySlug(slug: string) {
  const env = getNotionEnv();
  const schema = notionDataSources.posts.properties;

  const page = await queryFirstDataSourcePage({
    data_source_id: env.postsDataSourceId,
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

  return page ? normalizePost(page) : null;
}
