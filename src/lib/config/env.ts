import "server-only";
import { extractNotionId } from "@notionhq/client";
import { z } from "zod";

const notionEnvSchema = z.object({
  NOTION_TOKEN: z.string().trim().min(1),
  NOTION_POSTS_DATABASE_ID: z.string().trim().min(1),
  NOTION_CLASSES_DATABASE_ID: z.string().trim().min(1),
  NOTION_PRODUCTS_DATABASE_ID: z.string().trim().min(1),
  NOTION_REVIEWS_DATABASE_ID: z.string().trim().min(1),
  NOTION_SITE_SETTINGS_DATABASE_ID: z.string().trim().min(1),
});

type NotionEnv = {
  token: string;
  postsDataSourceId: string;
  classesDataSourceId: string;
  productsDataSourceId: string;
  reviewsDataSourceId: string;
  siteSettingsDataSourceId: string;
};

let notionEnvCache: NotionEnv | null = null;

function resolveNotionDataSourceId(value: string, envName: string) {
  const resolved = extractNotionId(value);

  if (!resolved) {
    throw new Error(
      `${envName} must be a valid Notion data source ID or a Notion URL containing one.`,
    );
  }

  return resolved;
}

export function getNotionEnv(): NotionEnv {
  if (notionEnvCache) {
    return notionEnvCache;
  }

  const parsed = notionEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    throw new Error(`Notion environment variables are not configured correctly. ${issues}`);
  }

  notionEnvCache = {
    token: parsed.data.NOTION_TOKEN,
    postsDataSourceId: resolveNotionDataSourceId(
      parsed.data.NOTION_POSTS_DATABASE_ID,
      "NOTION_POSTS_DATABASE_ID",
    ),
    classesDataSourceId: resolveNotionDataSourceId(
      parsed.data.NOTION_CLASSES_DATABASE_ID,
      "NOTION_CLASSES_DATABASE_ID",
    ),
    productsDataSourceId: resolveNotionDataSourceId(
      parsed.data.NOTION_PRODUCTS_DATABASE_ID,
      "NOTION_PRODUCTS_DATABASE_ID",
    ),
    reviewsDataSourceId: resolveNotionDataSourceId(
      parsed.data.NOTION_REVIEWS_DATABASE_ID,
      "NOTION_REVIEWS_DATABASE_ID",
    ),
    siteSettingsDataSourceId: resolveNotionDataSourceId(
      parsed.data.NOTION_SITE_SETTINGS_DATABASE_ID,
      "NOTION_SITE_SETTINGS_DATABASE_ID",
    ),
  };

  return notionEnvCache;
}

export function isNotionConfigured() {
  try {
    getNotionEnv();
    return true;
  } catch {
    return false;
  }
}
