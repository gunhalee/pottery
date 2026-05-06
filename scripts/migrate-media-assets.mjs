import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const apply = process.argv.includes("--apply");
const mediaBucket = "media-assets";
const legacySources = [
  {
    bucket: "content-images",
    ownerType: "content_entry",
    table: "content_images",
  },
  {
    bucket: "product-images",
    ownerType: "product",
    table: "shop_product_images",
  },
];

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith("#"))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [
        key.trim(),
        rest.join("=").trim().replace(/^['"]|['"]$/g, ""),
      ];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const rows = [];

for (const source of legacySources) {
  const select =
    source.table === "content_images"
      ? "id, entry_id, storage_path, src, alt, caption, width, height, is_cover, is_detail, is_list_image, layout, sort_order"
      : "id, product_id, storage_path, src, alt, width, height, is_primary, sort_order";
  const { data, error } = await supabase
    .from(source.table)
    .select(select)
    .not("storage_path", "is", null);

  if (error) {
    console.log(`[skip] ${source.table}: ${error.message}`);
    continue;
  }

  for (const row of data ?? []) {
    rows.push({ ...row, source });
  }
}

console.log(
  JSON.stringify(
    {
      apply,
      legacyRowsWithStorage: rows.length,
      targetBucket: mediaBucket,
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log("dry-run only. Re-run with --apply to copy files and insert media rows.");
  process.exit(0);
}

await ensureBucket();

for (const row of rows) {
  const assetId = randomUUID();
  const { data, error } = await supabase.storage
    .from(row.source.bucket)
    .download(row.storage_path);

  if (error) {
    throw new Error(`download failed ${row.source.bucket}/${row.storage_path}: ${error.message}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const variants = await buildVariants(buffer, assetId);
  const uploadedPaths = [];

  try {
    for (const variant of variants) {
      const { error: uploadError } = await supabase.storage
        .from(mediaBucket)
        .upload(variant.storagePath, variant.data, {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      uploadedPaths.push(variant.storagePath);
    }

    const master = variants.find((variant) => variant.variant === "master");
    const publicUrl = (storagePath) =>
      supabase.storage.from(mediaBucket).getPublicUrl(storagePath).data.publicUrl;

    const { error: assetError } = await supabase.from("media_assets").insert({
      alt: row.alt ?? "",
      bucket: mediaBucket,
      caption: row.caption ?? null,
      height: master.height,
      id: assetId,
      master_path: master.storagePath,
      mime_type: "image/webp",
      reserved: false,
      size_bytes: master.data.length,
      src: publicUrl(master.storagePath),
      width: master.width,
    });

    if (assetError) {
      throw new Error(assetError.message);
    }

    const { error: variantError } = await supabase.from("media_variants").insert(
      variants.map((variant) => ({
        asset_id: assetId,
        height: variant.height,
        size_bytes: variant.data.length,
        src: publicUrl(variant.storagePath),
        storage_path: variant.storagePath,
        variant: variant.variant,
        width: variant.width,
      })),
    );

    if (variantError) {
      throw new Error(variantError.message);
    }

    const usages = buildUsages(row, assetId);

    if (usages.length > 0) {
      const { error: usageError } = await supabase.from("media_usages").insert(usages);

      if (usageError) {
        throw new Error(usageError.message);
      }
    }

    console.log(`[ok] ${row.source.bucket}/${row.storage_path} -> ${assetId}`);
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(mediaBucket).remove(uploadedPaths);
    }

    throw error;
  }
}

async function ensureBucket() {
  const { error } = await supabase.storage.getBucket(mediaBucket);

  if (!error) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(mediaBucket, {
    allowedMimeTypes: ["image/webp"],
    fileSizeLimit: 8 * 1024 * 1024,
    public: true,
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(createError.message);
  }
}

async function buildVariants(buffer, assetId) {
  const normalized = sharp(buffer).rotate();
  const specs = [
    ["master", 2400, "inside"],
    ["detail", 1800, "inside"],
    ["list", 900, "cover"],
    ["thumbnail", 320, "cover"],
  ];
  const variants = [];

  for (const [variant, size, fit] of specs) {
    const image = await normalized
      .clone()
      .resize({
        fit,
        height: size,
        withoutEnlargement: fit === "inside",
        width: size,
      })
      .webp({ quality: variant === "thumbnail" ? 76 : 84 })
      .toBuffer({ resolveWithObject: true });

    variants.push({
      data: image.data,
      height: image.info.height,
      storagePath: `assets/${assetId}/${variant}.webp`,
      variant,
      width: image.info.width,
    });
  }

  return variants;
}

function buildUsages(row, assetId) {
  if (row.source.ownerType === "content_entry") {
    const roles = [
      row.is_cover ? "cover" : null,
      row.is_list_image ? "list" : null,
      row.is_detail ? "detail" : null,
    ].filter(Boolean);

    return roles.map((role) => ({
      alt_override: row.alt ?? null,
      asset_id: assetId,
      caption_override: row.caption ?? null,
      layout: row.layout ?? "default",
      owner_id: row.entry_id,
      owner_type: row.source.ownerType,
      role,
      sort_order: row.sort_order ?? 0,
    }));
  }

  return [
    {
      alt_override: row.alt ?? null,
      asset_id: assetId,
      caption_override: null,
      layout: null,
      owner_id: row.product_id,
      owner_type: row.source.ownerType,
      role: row.is_primary ? "cover" : "detail",
      sort_order: row.sort_order ?? 0,
    },
  ];
}
