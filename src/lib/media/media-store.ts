import "server-only";

import { randomUUID } from "node:crypto";
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

export type MediaAssetCreateInput = {
  alt: string;
  artworkTitle?: string;
  caption?: string;
  height: number;
  id?: string;
  masterPath: string;
  sizeBytes?: number;
  src: string;
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
) {
  const usageMap = new Map<string, MediaUsage[]>();

  if (!isSupabaseConfigured() || ownerIds.length === 0) {
    return usageMap;
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
    .eq("owner_type", ownerType)
    .in("owner_id", ownerIds)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to read media usages: ${error.message}`);
  }

  for (const row of (data ?? []) as MediaUsageRow[]) {
    const usage = fromMediaUsageRow(row);
    const usages = usageMap.get(usage.ownerId) ?? [];
    usages.push(usage);
    usageMap.set(usage.ownerId, usages);
  }

  return usageMap;
}

export async function readMediaLibraryAssets(limit = 80) {
  if (!isSupabaseConfigured()) {
    return [] satisfies Array<MediaAsset & { usageCount: number }>;
  }

  const supabase = getSupabaseAdminClient();
  const [{ data, error }, usageRows] = await Promise.all([
    supabase
      .from("media_assets")
      .select("*, media_variants (*)")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase.from("media_usages").select("asset_id"),
  ]);

  if (error) {
    throw new Error(`Failed to read media library: ${error.message}`);
  }

  if (usageRows.error) {
    throw new Error(`Failed to read media usage counts: ${usageRows.error.message}`);
  }

  const usageCounts = new Map<string, number>();

  for (const row of (usageRows.data ?? []) as Array<{ asset_id: string }>) {
    usageCounts.set(row.asset_id, (usageCounts.get(row.asset_id) ?? 0) + 1);
  }

  return ((data ?? []) as Array<
    MediaAssetRow & { media_variants?: MediaVariantRow[] | null }
  >).map((row) => ({
    ...fromMediaAssetRow(row, row.media_variants ?? []),
    usageCount: usageCounts.get(row.id) ?? 0,
  }));
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
  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      alt: input.alt,
      artwork_title: emptyToNull(input.artworkTitle),
      bucket: mediaAssetBucket,
      caption: emptyToNull(input.caption),
      height: input.height,
      id,
      master_path: input.masterPath,
      mime_type: "image/webp",
      reserved: false,
      size_bytes: input.sizeBytes ?? null,
      src: input.src,
      width: input.width,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create media asset: ${error.message}`);
  }

  if (input.variants.length > 0) {
    const { error: variantError } = await supabase
      .from("media_variants")
      .insert(
        input.variants.map((variant) => ({
          asset_id: id,
          height: variant.height,
          size_bytes: variant.sizeBytes ?? null,
          src: variant.src,
          storage_path: variant.storagePath,
          variant: variant.variant,
          width: variant.width,
        })),
      );

    if (variantError) {
      await supabase.from("media_assets").delete().eq("id", id);
      throw new Error(`Failed to create media variants: ${variantError.message}`);
    }
  }

  return {
    ...fromMediaAssetRow(data as MediaAssetRow, []),
    variants: input.variants.map((variant) => ({
      assetId: id,
      createdAt: new Date().toISOString(),
      height: variant.height,
      id: `${id}-${variant.variant}`,
      sizeBytes: variant.sizeBytes,
      src: variant.src,
      storagePath: variant.storagePath,
      variant: variant.variant,
      width: variant.width,
    })),
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
    const { count, error: countError } = await supabase
      .from("media_usages")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", asset.id);

    if (countError) {
      throw new Error(`Failed to inspect media usage: ${countError.message}`);
    }

    if ((count ?? 0) > 0) {
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
