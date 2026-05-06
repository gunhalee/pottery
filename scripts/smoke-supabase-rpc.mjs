import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const emptyRichTextBody = {
  root: {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

const env = {
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", ["SUPABASE_URL"]);
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", [
  "NEXT_SECRET_SUPABASE_SERVICE_ROLE_KEY",
]);
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
]);

const service = createSupabaseClient(serviceRoleKey);
const publicClient = createSupabaseClient(publishableKey);

const ids = {
  contentAsset: randomUUID(),
  contentEntry: randomUUID(),
  cronRun: randomUUID(),
  deniedAsset: randomUUID(),
  deniedContentEntry: randomUUID(),
  deniedProduct: randomUUID(),
  failedAsset: randomUUID(),
  failedContentEntry: randomUUID(),
  failedProduct: randomUUID(),
  privateContentEntry: randomUUID(),
  privateProduct: randomUUID(),
  product: randomUUID(),
  productAsset: randomUUID(),
  rateLimitKeyHash: randomUUID(),
  storageUploadIntent: randomUUID(),
};

const checks = [];

try {
  await cleanup();

  await verifyMediaAssetRpcSuccess();
  await verifyProductRpcSuccess();
  await verifyPublishedContentRls();
  await verifyPrivateRowsStayPrivate();
  await verifyMediaAssetRpcAtomicFailure();
  await verifyProductRpcAtomicFailure();
  await verifyContentEntryRpcAtomicFailure();
  await verifyPublicRpcDenied();
  await verifyCronRunLogAccess();
  await verifyStorageUploadIntentAccess();
  await verifyApiRateLimitAccess();
  await verifyDeleteRpcsSuccess();
  await cleanup();

  console.log("");
  console.log(`Supabase RPC/RLS smoke test passed (${checks.length} checks).`);
} catch (error) {
  await cleanup().catch((cleanupError) => {
    console.error(`cleanup failed: ${cleanupError.message}`);
  });

  console.error(error.message);
  process.exitCode = 1;
}

async function verifyMediaAssetRpcSuccess() {
  await createMediaAsset(ids.productAsset, "product");
  await createMediaAsset(ids.contentAsset, "content");

  await expectCount(service, "media_assets", "id", ids.productAsset, 1);
  await expectCount(service, "media_variants", "asset_id", ids.productAsset, 2);
  await expectCount(service, "media_assets", "id", ids.contentAsset, 1);
  await expectCount(service, "media_variants", "asset_id", ids.contentAsset, 2);
  pass("service role can create media assets with variants atomically");
}

async function verifyProductRpcSuccess() {
  const { error } = await service.rpc("save_shop_product_with_relations", {
    cafe24_row: buildCafe24Row(),
    media_usage_rows: [
      {
        alt_override: "Codex smoke product cover",
        asset_id: ids.productAsset,
        caption_override: null,
        layout: null,
        role: "cover",
        sort_order: 0,
      },
    ],
    product_row: buildProductRow(ids.product, true, "codex-smoke-public"),
  });

  assertNoError(error, "save_shop_product_with_relations");

  await expectCount(service, "shop_products", "id", ids.product, 1);
  await expectCount(
    service,
    "shop_product_cafe24_mappings",
    "product_id",
    ids.product,
    1,
  );
  await expectCount(service, "media_usages", "owner_id", ids.product, 1);

  await expectCount(publicClient, "shop_products", "id", ids.product, 1);
  await expectCount(
    publicClient,
    "shop_product_cafe24_mappings",
    "product_id",
    ids.product,
    1,
  );
  await expectCount(publicClient, "media_usages", "owner_id", ids.product, 1);
  await expectCount(publicClient, "media_assets", "id", ids.productAsset, 1);
  await expectCount(
    publicClient,
    "media_variants",
    "asset_id",
    ids.productAsset,
    2,
  );
  pass("published product, mapping, media usage, asset, and variants are public readable");
}

async function verifyPublishedContentRls() {
  const { error } = await service.rpc("save_content_entry_with_relations", {
    entry_row: buildContentEntryRow(
      ids.contentEntry,
      "gallery",
      true,
      "codex-smoke-gallery",
    ),
    media_usage_rows: [
      {
        alt_override: "Codex smoke content cover",
        asset_id: ids.contentAsset,
        caption_override: null,
        layout: "default",
        role: "cover",
        sort_order: 0,
      },
    ],
    reserved_asset_rows: [
      {
        asset_id: ids.contentAsset,
        reserved: false,
      },
    ],
  });
  assertNoError(error, "save_content_entry_with_relations");

  await expectCount(publicClient, "content_entries", "id", ids.contentEntry, 1);
  await expectCount(
    publicClient,
    "media_usages",
    "owner_id",
    ids.contentEntry,
    1,
  );
  await expectCount(publicClient, "media_assets", "id", ids.contentAsset, 1);
  await expectCount(
    publicClient,
    "media_variants",
    "asset_id",
    ids.contentAsset,
    2,
  );
  pass("published content media is public readable through RLS");
}

async function verifyPrivateRowsStayPrivate() {
  const { error: productError } = await service.rpc(
    "save_shop_product_with_relations",
    {
      cafe24_row: null,
      media_usage_rows: [],
      product_row: buildProductRow(
        ids.privateProduct,
        false,
        "codex-smoke-private",
      ),
    },
  );
  assertNoError(productError, "private save_shop_product_with_relations");

  const { error: contentError } = await service.rpc(
    "save_content_entry_with_relations",
    {
      entry_row: buildContentEntryRow(
        ids.privateContentEntry,
        "news",
        false,
        "codex-smoke-private-news",
      ),
      media_usage_rows: [],
      reserved_asset_rows: [],
    },
  );
  assertNoError(contentError, "private save_content_entry_with_relations");

  await expectCount(service, "shop_products", "id", ids.privateProduct, 1);
  await expectCount(publicClient, "shop_products", "id", ids.privateProduct, 0);
  await expectCount(
    service,
    "content_entries",
    "id",
    ids.privateContentEntry,
    1,
  );
  await expectCount(
    publicClient,
    "content_entries",
    "id",
    ids.privateContentEntry,
    0,
  );
  pass("draft product and content rows are hidden from public client");
}

async function verifyContentEntryRpcAtomicFailure() {
  const missingAssetId = randomUUID();
  const { error } = await service.rpc("save_content_entry_with_relations", {
    entry_row: buildContentEntryRow(
      ids.failedContentEntry,
      "gallery",
      true,
      "codex-smoke-content-failed",
    ),
    media_usage_rows: [
      {
        alt_override: "Missing asset",
        asset_id: missingAssetId,
        caption_override: null,
        layout: "default",
        role: "cover",
        sort_order: 0,
      },
    ],
    reserved_asset_rows: [
      {
        asset_id: ids.productAsset,
        reserved: true,
      },
    ],
  });

  assert(error, "expected content RPC with missing asset to fail");
  await expectCount(
    service,
    "content_entries",
    "id",
    ids.failedContentEntry,
    0,
  );
  await expectCount(service, "media_usages", "owner_id", ids.failedContentEntry, 0);
  await expectValue(service, "media_assets", "id", ids.productAsset, "reserved", false);
  pass("failed content RPC leaves no partial entry, usage, or reserved asset update");
}

async function verifyMediaAssetRpcAtomicFailure() {
  const { error } = await service.rpc("create_media_asset_with_variants", {
    asset_row: buildAssetRow(ids.failedAsset, "failed"),
    variant_rows: [
      {
        height: 16,
        size_bytes: 128,
        src: "https://example.test/codex-smoke/failed-invalid.webp",
        storage_path: `codex-smoke/${ids.failedAsset}/invalid.webp`,
        variant: "invalid_variant",
        width: 16,
      },
    ],
  });

  assert(error, "expected invalid media variant RPC to fail");
  await expectCount(service, "media_assets", "id", ids.failedAsset, 0);
  await expectCount(service, "media_variants", "asset_id", ids.failedAsset, 0);
  pass("failed media asset RPC leaves no partial asset or variants");
}

async function verifyProductRpcAtomicFailure() {
  const missingAssetId = randomUUID();
  const { error } = await service.rpc("save_shop_product_with_relations", {
    cafe24_row: buildCafe24Row(),
    media_usage_rows: [
      {
        alt_override: "Missing asset",
        asset_id: missingAssetId,
        caption_override: null,
        layout: null,
        role: "cover",
        sort_order: 0,
      },
    ],
    product_row: buildProductRow(ids.failedProduct, true, "codex-smoke-failed"),
  });

  assert(error, "expected product RPC with missing asset to fail");
  await expectCount(service, "shop_products", "id", ids.failedProduct, 0);
  await expectCount(
    service,
    "shop_product_cafe24_mappings",
    "product_id",
    ids.failedProduct,
    0,
  );
  await expectCount(service, "media_usages", "owner_id", ids.failedProduct, 0);
  pass("failed product RPC leaves no partial product, mapping, or usage rows");
}

async function verifyPublicRpcDenied() {
  const deniedAsset = await publicClient.rpc("create_media_asset_with_variants", {
    asset_row: buildAssetRow(ids.deniedAsset, "denied"),
    variant_rows: [],
  });
  assert(
    deniedAsset.error,
    "public client unexpectedly executed create_media_asset_with_variants",
  );

  const deniedProduct = await publicClient.rpc("save_shop_product_with_relations", {
    cafe24_row: null,
    media_usage_rows: [],
    product_row: buildProductRow(ids.deniedProduct, true, "codex-smoke-denied"),
  });
  assert(
    deniedProduct.error,
    "public client unexpectedly executed save_shop_product_with_relations",
  );

  const deniedContent = await publicClient.rpc("save_content_entry_with_relations", {
    entry_row: buildContentEntryRow(
      ids.deniedContentEntry,
      "news",
      true,
      "codex-smoke-denied-news",
    ),
    media_usage_rows: [],
    reserved_asset_rows: [],
  });
  assert(
    deniedContent.error,
    "public client unexpectedly executed save_content_entry_with_relations",
  );

  const deniedProductDelete = await publicClient.rpc(
    "delete_shop_product_with_relations",
    {
      target_product_id: ids.product,
    },
  );
  assert(
    deniedProductDelete.error,
    "public client unexpectedly executed delete_shop_product_with_relations",
  );

  const deniedContentDelete = await publicClient.rpc(
    "delete_content_entry_with_relations",
    {
      target_entry_id: ids.contentEntry,
    },
  );
  assert(
    deniedContentDelete.error,
    "public client unexpectedly executed delete_content_entry_with_relations",
  );

  await expectCount(service, "media_assets", "id", ids.deniedAsset, 0);
  await expectCount(service, "shop_products", "id", ids.deniedProduct, 0);
  await expectCount(service, "content_entries", "id", ids.deniedContentEntry, 0);
  await expectCount(service, "shop_products", "id", ids.product, 1);
  await expectCount(service, "content_entries", "id", ids.contentEntry, 1);
  pass("public client cannot execute write or delete RPCs");
}

async function verifyDeleteRpcsSuccess() {
  const productDelete = await service.rpc("delete_shop_product_with_relations", {
    target_product_id: ids.product,
  });
  assertNoError(productDelete.error, "delete_shop_product_with_relations");

  await expectCount(service, "shop_products", "id", ids.product, 0);
  await expectCount(
    service,
    "shop_product_cafe24_mappings",
    "product_id",
    ids.product,
    0,
  );
  await expectCount(service, "media_usages", "owner_id", ids.product, 0);
  await expectCount(publicClient, "media_assets", "id", ids.productAsset, 0);

  const contentDelete = await service.rpc("delete_content_entry_with_relations", {
    target_entry_id: ids.contentEntry,
  });
  assertNoError(contentDelete.error, "delete_content_entry_with_relations");

  await expectCount(service, "content_entries", "id", ids.contentEntry, 0);
  await expectCount(service, "media_usages", "owner_id", ids.contentEntry, 0);
  await expectCount(publicClient, "media_assets", "id", ids.contentAsset, 0);
  pass("delete RPCs remove owner rows and media usages atomically");
}

async function verifyCronRunLogAccess() {
  const { error: insertError } = await service.from("cron_run_logs").insert({
    id: ids.cronRun,
    job_name: "upload_cleanup",
    started_at: new Date().toISOString(),
    status: "running",
    summary: { smoke: true, stage: "started" },
    trigger_source: "smoke",
  });
  assertNoError(insertError, "cron_run_logs insert");

  const { error: updateError } = await service
    .from("cron_run_logs")
    .update({
      duration_ms: 1,
      finished_at: new Date().toISOString(),
      status: "success",
      summary: { smoke: true, stage: "finished" },
    })
    .eq("id", ids.cronRun);
  assertNoError(updateError, "cron_run_logs update");

  await expectCount(service, "cron_run_logs", "id", ids.cronRun, 1);

  const publicResult = await publicClient
    .from("cron_run_logs")
    .select("*", { count: "exact", head: true })
    .eq("id", ids.cronRun);
  assert(
    publicResult.error || publicResult.count === 0,
    "public client unexpectedly read cron_run_logs",
  );
  pass("service role can record cron runs while public client cannot read cron logs");
}

async function verifyStorageUploadIntentAccess() {
  const { error: insertError } = await service
    .from("storage_upload_intents")
    .insert({
      asset_id: ids.failedAsset,
      bucket: "media-assets",
      id: ids.storageUploadIntent,
      metadata: { smoke: true },
      status: "pending",
    });
  assertNoError(insertError, "storage_upload_intents insert");

  const { error: updateError } = await service
    .from("storage_upload_intents")
    .update({
      completed_at: new Date().toISOString(),
      status: "cleaned",
      storage_paths: [`codex-smoke/${ids.failedAsset}/orphan.webp`],
    })
    .eq("id", ids.storageUploadIntent);
  assertNoError(updateError, "storage_upload_intents update");

  await expectCount(
    service,
    "storage_upload_intents",
    "id",
    ids.storageUploadIntent,
    1,
  );

  const publicResult = await publicClient
    .from("storage_upload_intents")
    .select("*", { count: "exact", head: true })
    .eq("id", ids.storageUploadIntent);
  assert(
    publicResult.error || publicResult.count === 0,
    "public client unexpectedly read storage_upload_intents",
  );
  pass("service role can track storage upload intents while public client cannot read them");
}

async function verifyApiRateLimitAccess() {
  const first = await service.rpc("consume_api_rate_limit", {
    p_key_hash: ids.rateLimitKeyHash,
    p_limit: 2,
    p_namespace: "smoke",
    p_window_seconds: 60,
  });
  assertNoError(first.error, "consume_api_rate_limit first call");
  assert(first.data?.[0]?.allowed === true, "first rate limit call should pass");

  const second = await service.rpc("consume_api_rate_limit", {
    p_key_hash: ids.rateLimitKeyHash,
    p_limit: 2,
    p_namespace: "smoke",
    p_window_seconds: 60,
  });
  assertNoError(second.error, "consume_api_rate_limit second call");
  assert(second.data?.[0]?.allowed === true, "second rate limit call should pass");

  const third = await service.rpc("consume_api_rate_limit", {
    p_key_hash: ids.rateLimitKeyHash,
    p_limit: 2,
    p_namespace: "smoke",
    p_window_seconds: 60,
  });
  assertNoError(third.error, "consume_api_rate_limit third call");
  assert(third.data?.[0]?.allowed === false, "third rate limit call should block");

  const deniedRateLimit = await publicClient.rpc("consume_api_rate_limit", {
    p_key_hash: ids.rateLimitKeyHash,
    p_limit: 2,
    p_namespace: "smoke",
    p_window_seconds: 60,
  });
  assert(
    deniedRateLimit.error,
    "public client unexpectedly executed consume_api_rate_limit",
  );
  pass("service role can consume API rate limits atomically while public client cannot");
}

async function createMediaAsset(id, label) {
  const { error } = await service.rpc("create_media_asset_with_variants", {
    asset_row: buildAssetRow(id, label),
    variant_rows: [
      buildVariantRow(id, "master", 16),
      buildVariantRow(id, "thumbnail", 8),
    ],
  });

  assertNoError(error, `create_media_asset_with_variants:${label}`);
}

function buildAssetRow(id, label) {
  return {
    alt: `Codex smoke ${label} asset`,
    artwork_title: "Codex Smoke",
    bucket: "media-assets",
    caption: "Temporary smoke test asset",
    height: 16,
    id,
    master_path: `codex-smoke/${id}/master.webp`,
    mime_type: "image/webp",
    reserved: false,
    size_bytes: 128,
    src: `https://example.test/codex-smoke/${id}/master.webp`,
    width: 16,
  };
}

function buildVariantRow(id, variant, size) {
  return {
    height: size,
    size_bytes: variant === "thumbnail" ? 64 : 128,
    src: `https://example.test/codex-smoke/${id}/${variant}.webp`,
    storage_path: `codex-smoke/${id}/${variant}.webp`,
    variant,
    width: size,
  };
}

function buildProductRow(id, published, slugPrefix) {
  const now = new Date().toISOString();

  return {
    availability_status: "upcoming",
    care_note: null,
    category: "cup",
    created_at: now,
    currency: "KRW",
    glaze: null,
    id,
    is_archived: false,
    is_limited: false,
    kind: "regular",
    limited_type: null,
    material: null,
    price_krw: 1000,
    published,
    published_at: published ? "2026-05-06" : null,
    restock_cta_type: "restock_alert",
    shipping_note: null,
    short_description: "Temporary smoke test product",
    size: null,
    slug: `${slugPrefix}-${id.slice(0, 8)}`,
    stock_quantity: 1,
    story: null,
    story_json: emptyRichTextBody,
    story_text: "",
    title_ko: "Codex Smoke Product",
    updated_at: now,
    usage_note: null,
  };
}

function buildContentEntryRow(id, kind, published, slugPrefix) {
  const now = new Date().toISOString();

  return {
    body_json: emptyRichTextBody,
    body_text: "",
    display_date: "2026.05",
    id,
    kind,
    published_at: published ? "2026-05-06" : null,
    related_product_slug: null,
    slug: `${slugPrefix}-${id.slice(0, 8)}`,
    status: published ? "published" : "draft",
    summary: "Temporary smoke test content entry",
    title: "Codex Smoke Content",
    updated_at: now,
  };
}

function buildCafe24Row() {
  return {
    category_no: 29,
    checkout_url: null,
    display_group: 1,
    last_sync_error: null,
    last_synced_at: null,
    mapping_status: "pending",
    product_no: null,
    product_url: null,
    variant_code: null,
  };
}

async function expectCount(client, table, column, value, expected) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);

  assertNoError(error, `${table}.${column} count`);
  assert(
    count === expected,
    `expected ${table}.${column}=${value} count ${expected}, got ${count}`,
  );
}

async function expectValue(client, table, column, value, selectColumn, expected) {
  const { data, error } = await client
    .from(table)
    .select(selectColumn)
    .eq(column, value)
    .single();

  assertNoError(error, `${table}.${column} value`);
  assert(
    data?.[selectColumn] === expected,
    `expected ${table}.${selectColumn} to be ${expected}, got ${data?.[selectColumn]}`,
  );
}

async function cleanup() {
  const productIds = [
    ids.deniedProduct,
    ids.failedProduct,
    ids.privateProduct,
    ids.product,
  ];
  const contentIds = [
    ids.contentEntry,
    ids.deniedContentEntry,
    ids.failedContentEntry,
    ids.privateContentEntry,
  ];
  const assetIds = [
    ids.contentAsset,
    ids.deniedAsset,
    ids.failedAsset,
    ids.productAsset,
  ];

  await deleteIn("media_usages", "owner_id", [...productIds, ...contentIds]);
  await deleteIn("media_usages", "asset_id", assetIds);
  await deleteIn("shop_product_cafe24_mappings", "product_id", productIds);
  await deleteIn("shop_products", "id", productIds);
  await deleteIn("content_entries", "id", contentIds);
  await deleteIn("media_variants", "asset_id", assetIds);
  await deleteIn("media_assets", "id", assetIds);
  await deleteIn("api_rate_limit_buckets", "key_hash", [ids.rateLimitKeyHash]);
  await deleteIn("cron_run_logs", "id", [ids.cronRun]);
  await deleteIn("storage_upload_intents", "id", [ids.storageUploadIntent]);
}

async function deleteIn(table, column, values) {
  const filtered = values.filter(Boolean);

  if (filtered.length === 0) {
    return;
  }

  const { error } = await service.from(table).delete().in(column, filtered);
  assertNoError(error, `cleanup ${table}.${column}`);
}

function createSupabaseClient(key) {
  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
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
}

function requireEnv(name, fallbacks = []) {
  for (const key of [name, ...fallbacks]) {
    const value = env[key];

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

function assertNoError(error, label) {
  if (error) {
    throw new Error(`${label} failed: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pass(message) {
  checks.push(message);
  console.log(`[ok] ${message}`);
}
