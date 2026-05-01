import "server-only";
import { z } from "zod";
import { getNotionEnv } from "@/lib/config/env";
import { type NotionSiteSettings } from "@/types";
import { notionDataSources } from "./schema";
import {
  getRichTextProperty,
  getTitleProperty,
  getUrlProperty,
} from "./properties";
import { getPageMeta, nullableUrlSchema, parseNotionEntity } from "./normalize";
import { queryFirstDataSourcePage } from "./query";

const siteSettingsSchema = z.object({
  pageId: z.string().uuid(),
  pageUrl: z.string().url(),
  createdTime: z.string(),
  lastEditedTime: z.string(),
  siteName: z.string().trim().min(1),
  brandSlogan: z.string(),
  address: z.string(),
  parkingInfo: z.string(),
  businessHours: z.string(),
  kakaoChannelUrl: z.string().url(),
  instagramUrl: nullableUrlSchema,
  smartstoreUrl: nullableUrlSchema,
  seoDefaultTitle: z.string().nullable(),
  seoDefaultDescription: z.string().nullable(),
});

function normalizeSiteSettings(
  page: Parameters<typeof getPageMeta>[0],
): NotionSiteSettings {
  const properties = page.properties;
  const schema = notionDataSources.siteSettings.properties;

  return parseNotionEntity(
    siteSettingsSchema,
    {
      ...getPageMeta(page),
      siteName: getTitleProperty(properties, schema.siteName),
      brandSlogan: getRichTextProperty(properties, schema.brandSlogan),
      address: getRichTextProperty(properties, schema.address),
      parkingInfo: getRichTextProperty(properties, schema.parkingInfo),
      businessHours: getRichTextProperty(properties, schema.businessHours),
      kakaoChannelUrl: getUrlProperty(properties, schema.kakaoChannelUrl),
      instagramUrl: getUrlProperty(properties, schema.instagramUrl),
      smartstoreUrl: getUrlProperty(properties, schema.smartstoreUrl),
      seoDefaultTitle: getRichTextProperty(properties, schema.seoDefaultTitle) || null,
      seoDefaultDescription:
        getRichTextProperty(properties, schema.seoDefaultDescription) || null,
    },
    `site settings page ${page.id}`,
  );
}

export async function getSiteSettings() {
  const env = getNotionEnv();

  const page = await queryFirstDataSourcePage({
    data_source_id: env.siteSettingsDataSourceId,
  });

  return page ? normalizeSiteSettings(page) : null;
}
