import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type {
  MediaAsset,
  MediaOwnerType,
  MediaUsage,
  MediaUsageRole,
  MediaVariant,
  MediaVariantName,
} from "./media-model";

export const mediaAssetBucket = "media-assets";

type MediaAssetRow = {
  alt: string;
  artwork_title: string | null;
  bucket: string;
  caption: string | null;
  created_at: string;
  height: number;
  id: string;
  master_path: string;
  mime_type: string;
  reserved: boolean;
  size_bytes: number | null;
  src: string;
  updated_at: string;
  width: number;
};

type MediaVariantRow = {
  asset_id: string;
  created_at: string;
  height: number;
  id: string;
  size_bytes: number | null;
  src: string;
  storage_path: string;
  variant: MediaVariantName;
  width: number;
};

type MediaUsageRow = {
  alt_override: string | null;
  asset_id: string;
  caption_override: string | null;
  created_at: string;
  id: string;
  layout: string | null;
  media_assets?: (MediaAssetRow & {
    media_variants?: MediaVariantRow[] | null;
  }) | null;
  owner_id: string;
  owner_type: MediaOwnerType;
  role: MediaUsageRole;
  sort_order: number;
  updated_at: string;
};

type MediaUsageReadOptions = {
  client?: SupabaseClient;
  roles?: MediaUsageRole[];
};

export type MediaAssetCreateInput = {
  alt: string;
  artworkTitle?: string;
  caption?: string;
  height: number;
  id?: string;
  masterPath: string;
  sizeBytes?: number;
  src: string;
  reserved?: boolean;
  variants: Array<{
    height: number;
    sizeBytes?: number;
    src: string;
    storagePath: string;
    variant: MediaVariantName;
    width: number;
  }>;
  width: number;
};

export type MediaUsageReplaceInput = {
  altOverride?: string;
  assetId: string;
  captionOverride?: string;
  layout?: string;
  role: MediaUsageRole;
  sortOrder: number;
};

export async function readMediaUsagesByOwner(
  ownerType: MediaOwnerType,
  ownerIds: string[],
  options: MediaUsageReadOptions = {},
) {
  const usageMap = new Map<string, MediaUsage[]>();

  if ((!isSupabaseConfigured() && !options.client) || ownerIds.length === 0) {
    return usageMap;
  }

  const supabase = options.client ?? getSupabaseAdminClient();
  let query = supabase
    .from("media_usages")
    .select(
      `
        id,
        owner_type,
        owner_id,
        asset_id,
        role,
        sort_order,
        layout,
        alt_override,
        caption_override,
        created_at,
        updated_at,
        media_assets (
          id,
          alt,
          artwork_title,
          bucket,
          caption,
          created_at,
          height,
          master_path,
          mime_type,
          reserved,
          size_bytes,
          src,
          updated_at,
          width,
          media_variants (
            id,
            asset_id,
            created_at,
            height,
            size_bytes,
            src,
            storage_path,
            variant,
            width
          )
        )
      `,
    )
    .eq("owner_type", ownerType)
    .in("owner_id", ownerIds)
    .order("sort_order", { ascending: true });

  if (options.roles?.length) {
    query = query.in("role", options.roles);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to read media usages: ${error.message}`);
  }

  for (const row of (data ?? []) as unknown as MediaUsageRow[]) {
    const usage = fromMediaUsageRow(row);
    const usages = usageMap.get(usage.ownerId) ?? [];
    usages.push(usage);
    usageMap.set(usage.ownerId, usages);
  }

  return usageMap;
}

export async function readMediaLibraryAssets(
  limit = 80,
  options: { includeReserved?: boolean } = {},
) {
  if (!isSupabaseConfigured()) {
    return [] satisfies Array<MediaAsset & { usageCount: number }>;
  }

  const supabase = getSupabaseAdminClient();
  let assetQuery = supabase
    .from("media_assets")
    .select("*, media_variants (*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!options.includeReserved) {
    assetQuery = assetQuery.eq("reserved", false);
  }

  const [{ data, error }, usageRows] = await Promise.all([
    assetQuery,
    readMediaAssetUsageCounts(supabase),
  ]);

  if (error) {
    throw new Error(`Failed to read media library: ${error.message}`);
  }

  return ((data ?? []) as Array<
    MediaAssetRow & { media_variants?: MediaVariantRow[] | null }
  >).map((row) => ({
    ...fromMediaAssetRow(row, row.media_variants ?? []),
    usageCount: usageRows.get(row.id) ?? 0,
  }));
}

export async function readMediaAssetsByIds(assetIds: string[]) {
  if (!isSupabaseConfigured() || assetIds.length === 0) {
    return [] satisfies MediaAsset[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("*, media_variants (*)")
    .in("id", [...new Set(assetIds)]);

  if (error) {
    throw new Error(`Failed to read media assets: ${error.message}`);
  }

  return ((data ?? []) as Array<
    MediaAssetRow & { media_variants?: MediaVariantRow[] | null }
  >).map((row) => fromMediaAssetRow(row, row.media_variants ?? []));
}

export async function readMediaUsageRowsForAsset(assetId: string) {
  if (!isSupabaseConfigured()) {
    return [] satisfies MediaUsage[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("media_usages")
    .select(
      `
        *,
        media_assets (
          *,
          media_variants (*)
        )
      `,
    )
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to read media usages: ${error.message}`);
  }

  return ((data ?? []) as MediaUsageRow[]).map((row) =>
    fromMediaUsageRow(row),
  );
}

export async function createMediaAsset(input: MediaAssetCreateInput) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const id = input.id ?? randomUUID();
  const createdAt = new Date().toISOString();
  const { error } = await supabase.rpc("create_media_asset_with_variants", {
    asset_row: {
      alt: input.alt,
      artwork_title: emptyToNull(input.artworkTitle),
      bucket: mediaAssetBucket,
      caption: emptyToNull(input.caption),
      height: input.height,
      id,
      master_path: input.masterPath,
      mime_type: "image/webp",
      reserved: Boolean(input.reserved),
      size_bytes: input.sizeBytes ?? null,
      src: input.src,
      width: input.width,
    },
    variant_rows: input.variants.map((variant) => ({
      height: variant.height,
      size_bytes: variant.sizeBytes ?? null,
      src: variant.src,
      storage_path: variant.storagePath,
      variant: variant.variant,
      width: variant.width,
    })),
  });

  if (error) {
    throw new Error(`Failed to create media asset: ${error.message}`);
  }

  return {
    alt: input.alt,
    artworkTitle: input.artworkTitle,
    bucket: mediaAssetBucket,
    caption: input.caption,
    createdAt,
    height: input.height,
    id,
    masterPath: input.masterPath,
    mimeType: "image/webp",
    reserved: Boolean(input.reserved),
    sizeBytes: input.sizeBytes,
    src: input.src,
    updatedAt: createdAt,
    variants: input.variants.map((variant) => ({
      assetId: id,
      createdAt,
      height: variant.height,
      id: `${id}-${variant.variant}`,
      sizeBytes: variant.sizeBytes,
      src: variant.src,
      storagePath: variant.storagePath,
      variant: variant.variant,
      width: variant.width,
    })),
    width: input.width,
  } satisfies MediaAsset;
}

export async function replaceMediaUsagesForOwner(
  ownerType: MediaOwnerType,
  ownerId: string,
  usages: MediaUsageReplaceInput[],
) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error: deleteError } = await supabase
    .from("media_usages")
    .delete()
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId);

  if (deleteError) {
    throw new Error(`Failed to reset media usages: ${deleteError.message}`);
  }

  if (usages.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("media_usages").insert(
    usages.map((usage) => ({
      alt_override: emptyToNull(usage.altOverride),
      asset_id: usage.assetId,
      caption_override: emptyToNull(usage.captionOverride),
      layout: emptyToNull(usage.layout),
      owner_id: ownerId,
      owner_type: ownerType,
      role: usage.role,
      sort_order: usage.sortOrder,
    })),
  );

  if (insertError) {
    throw new Error(`Failed to save media usages: ${insertError.message}`);
  }
}

export async function deleteMediaUsagesForAsset(
  ownerType: MediaOwnerType,
  ownerId: string,
  assetId: string,
) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("media_usages")
    .delete()
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("asset_id", assetId);

  if (error) {
    throw new Error(`Failed to delete media usage: ${error.message}`);
  }
}

export async function setMediaAssetReserved(assetId: string, reserved: boolean) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("media_assets")
    .update({ reserved })
    .eq("id", assetId);

  if (error) {
    throw new Error(`Failed to update media asset state: ${error.message}`);
  }
}

export async function deleteUnusedMediaAssetsByMasterPaths(
  masterPaths: string[],
) {
  if (!isSupabaseConfigured() || masterPaths.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const uniquePaths = [...new Set(masterPaths)];
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, master_path, media_variants (storage_path)")
    .in("master_path", uniquePaths);

  if (error) {
    throw new Error(`Failed to inspect media assets: ${error.message}`);
  }

  for (const asset of (data ?? []) as Array<{
    id: string;
    master_path: string;
    media_variants?: Array<{ storage_path: string }> | null;
  }>) {
    if ((await getMediaAssetUsageCount(supabase, asset.id)) > 0) {
      continue;
    }

    const storagePaths = [
      asset.master_path,
      ...(asset.media_variants ?? []).map((variant) => variant.storage_path),
    ];
    const { error: removeError } = await supabase.storage
      .from(mediaAssetBucket)
      .remove([...new Set(storagePaths)]);

    if (removeError) {
      throw new Error(removeError.message);
    }

    const { error: deleteError } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", asset.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }
}

export function pickMediaVariant(asset: MediaAsset, variant: MediaVariantName) {
  return asset.variants.find((item) => item.variant === variant) ?? null;
}

function fromMediaUsageRow(row: MediaUsageRow): MediaUsage {
  if (!row.media_assets) {
    throw new Error(`Media usage ${row.id} is missing its asset.`);
  }

  return {
    altOverride: row.alt_override ?? undefined,
    asset: fromMediaAssetRow(
      row.media_assets,
      row.media_assets.media_variants ?? [],
    ),
    assetId: row.asset_id,
    captionOverride: row.caption_override ?? undefined,
    createdAt: row.created_at,
    id: row.id,
    layout: row.layout ?? undefined,
    ownerId: row.owner_id,
    ownerType: row.owner_type,
    role: row.role,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

function fromMediaAssetRow(
  row: MediaAssetRow,
  variants: MediaVariantRow[],
): MediaAsset {
  return {
    alt: row.alt,
    artworkTitle: row.artwork_title ?? undefined,
    bucket: row.bucket,
    caption: row.caption ?? undefined,
    createdAt: row.created_at,
    height: row.height,
    id: row.id,
    masterPath: row.master_path,
    mimeType: row.mime_type,
    reserved: row.reserved,
    sizeBytes: row.size_bytes ?? undefined,
    src: row.src,
    updatedAt: row.updated_at,
    variants: variants
      .map((variant) => fromMediaVariantRow(variant))
      .sort((a, b) => variantRank(a.variant) - variantRank(b.variant)),
    width: row.width,
  };
}

function fromMediaVariantRow(row: MediaVariantRow): MediaVariant {
  return {
    assetId: row.asset_id,
    createdAt: row.created_at,
    height: row.height,
    id: row.id,
    sizeBytes: row.size_bytes ?? undefined,
    src: row.src,
    storagePath: row.storage_path,
    variant: row.variant,
    width: row.width,
  };
}

function variantRank(variant: MediaVariantName) {
  return {
    master: 0,
    detail: 1,
    list: 2,
    thumbnail: 3,
  }[variant];
}

function emptyToNull(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function readMediaAssetUsageCounts(supabase: SupabaseClient) {
  const usageCounts = new Map<string, number>();
  const tables = [
    { column: "asset_id", name: "media_usages" },
    { column: "media_asset_id", name: "shop_product_feedback_images" },
    { column: "media_asset_id", name: "class_review_images" },
    { column: "media_asset_id", name: "shop_return_request_images" },
  ];
  const rows = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await supabase
        .from(table.name)
        .select(table.column);

      if (error) {
        if (isMissingUsageTableError(error)) {
          return [] as string[];
        }

        throw new Error(`Failed to read ${table.name} usage counts: ${error.message}`);
      }

      return ((data ?? []) as unknown as Array<Record<string, string | null>>)
        .map((row) => row[table.column])
        .filter((value): value is string => Boolean(value));
    }),
  );

  for (const assetId of rows.flat()) {
    usageCounts.set(assetId, (usageCounts.get(assetId) ?? 0) + 1);
  }

  return usageCounts;
}

async function getMediaAssetUsageCount(
  supabase: SupabaseClient,
  assetId: string,
) {
  const usageCounts = await readMediaAssetUsageCounts(supabase);

  return usageCounts.get(assetId) ?? 0;
}

function isMissingUsageTableError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("relation")
  );
}
