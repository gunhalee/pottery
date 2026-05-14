import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

await loadEnvFile(".env.local");
await loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const now = new Date().toISOString();
const today = now.slice(0, 10);

const mediaAssets = [
  {
    alt: "초록 줄기가 흙색 토분 안쪽으로 드리운 화분 위의 숲",
    height: 638,
    id: "22000000-0000-0000-0000-000000000001",
    key: "pot-on-forest",
    src: "https://qcvkeizmywxxkqomiljy.supabase.co/storage/v1/object/public/media-assets/assets/b3606020-0199-46cb-88a5-a2a83566af99/detail.webp",
    width: 850,
  },
  {
    alt: "햇빛이 드는 창가에 놓인 흰 도자 화분과 초록 잎",
    height: 600,
    id: "22000000-0000-0000-0000-000000000002",
    key: "green-pot",
    src: "/asset/green-pot.webp",
    width: 600,
  },
  {
    alt: "화분 위 흙에 놓인 흙으로 만든 작은 강아지 기물",
    height: 600,
    id: "22000000-0000-0000-0000-000000000003",
    key: "clay-dog",
    src: "/asset/dog.webp",
    width: 600,
  },
];

const galleryEntries = [
  {
    assetId: mediaAssets[0].id,
    bodyText:
      "화분과 초록, 작은 동물의 자리가 한 장면 안에 놓이는 작업입니다. 흙으로 빚은 작은 형태가 식물 곁에 머물며 생명의 리듬을 조용히 이어갑니다.",
    displayDate: "작업물",
    id: "23000000-0000-0000-0000-000000000001",
    slug: "pot-on-forest",
    summary: "초록이 머무는 작은 풍경",
    title: "화분 위의 숲",
  },
  {
    assetId: mediaAssets[1].id,
    bodyText:
      "초록을 담는 도자는 단순한 화분이 아니라 생명이 머무를 자리를 함께 생각하는 일입니다. 손으로 남긴 결은 빛과 잎, 흙의 표정을 받아냅니다.",
    displayDate: "작업물",
    id: "23000000-0000-0000-0000-000000000002",
    slug: "green-pot",
    summary: "식물 곁에 오래 놓이는 형태",
    title: "초록을 담은 화분",
  },
  {
    assetId: mediaAssets[2].id,
    bodyText:
      "공방에는 사람과 식물뿐 아니라 동물의 온기도 함께 머뭅니다. 흙으로 만든 작은 친구들은 화분 위의 풍경 안에서 다시 생명을 얻습니다.",
    displayDate: "작업물",
    id: "23000000-0000-0000-0000-000000000003",
    slug: "clay-dog",
    summary: "흙으로 다시 태어난 작은 생명",
    title: "화분 곁의 친구",
  },
];

const newsEntries = [
  {
    bodyText:
      "원데이 클래스와 커플 원데이 클래스는 처음 흙을 만지는 분도 편하게 시작할 수 있는 시간입니다. 정규반은 익힘반, 익숙반, 야심반으로 나뉘어 각자의 속도에 맞춰 흙을 다룹니다.",
    displayDate: "2026.05",
    id: "24000000-0000-0000-0000-000000000001",
    slug: "class-program-note",
    summary: "원데이, 커플 원데이, 익힘반과 익숙반 안내",
    title: "클래스 안내",
  },
  {
    bodyText:
      "콩새와 도자기공방은 초록을 담은 흙의 형태를 빚습니다. 화분, 그릇, 작은 기물 속에 사람과 식물, 동물의 이야기를 녹여냅니다.",
    displayDate: "2026.05",
    id: "24000000-0000-0000-0000-000000000002",
    slug: "green-and-clay-note",
    summary: "초록과 도자, 사람과 동물이 함께 놓이는 공방의 기록",
    title: "초록과 도자의 기록",
  },
  {
    bodyText:
      "공방을 다녀간 사람들의 손에는 각자의 속도와 모양이 남습니다. 짧은 체험의 접시부터 오래 다듬은 기물까지, 함께 빚어진 시간은 흙 위에 조용히 기록됩니다.",
    displayDate: "2026.05",
    id: "24000000-0000-0000-0000-000000000003",
    slug: "studio-records-note",
    summary: "공방을 다녀간 사람들의 손과 시간",
    title: "함께 한 기록",
  },
];

const classReviews = [
  {
    body:
      "함께 빚은 접시가 그날의 오래 기억되는 물건으로 남았습니다.",
    classTitle: "커플 원데이클래스",
    displayName: "커플 수강생",
    id: "25000000-0000-0000-0000-000000000001",
  },
  {
    body:
      "서로의 대화를 나누며 컵을 만들고 완성될 시간을 함께 기다렸습니다.",
    classTitle: "원데이클래스",
    displayName: "원데이 수강생",
    id: "25000000-0000-0000-0000-000000000002",
  },
  {
    body:
      "처음 만지는 흙도 천천히 다루면 각자의 모양으로 남는다는 걸 배웠습니다.",
    classTitle: "익힘반",
    displayName: "익힘반 수강생",
    id: "25000000-0000-0000-0000-000000000003",
  },
];

await upsertMediaAssets(mediaAssets);
await upsertContentEntries("gallery", galleryEntries);
await upsertContentEntries("news", newsEntries);
await upsertClassReviews(classReviews);

console.log(
  `Seeded ${galleryEntries.length} gallery entries, ${newsEntries.length} news entries, and ${classReviews.length} class reviews.`,
);

async function upsertMediaAssets(assets) {
  const { error: assetError } = await supabase.from("media_assets").upsert(
    assets.map((asset) => ({
      alt: asset.alt,
      bucket: "media-assets",
      height: asset.height,
      id: asset.id,
      master_path: `seed/site/${asset.key}/master.webp`,
      mime_type: "image/webp",
      reserved: false,
      src: asset.src,
      updated_at: now,
      width: asset.width,
    })),
    { onConflict: "id" },
  );

  if (assetError) {
    throw new Error(`Media asset seed failed: ${assetError.message}`);
  }

  const variants = assets.flatMap((asset) =>
    ["master", "detail", "list", "thumbnail"].map((variant) => ({
      asset_id: asset.id,
      height: asset.height,
      src: asset.src,
      storage_path: `seed/site/${asset.key}/${variant}.webp`,
      variant,
      width: asset.width,
    })),
  );
  const { error: variantError } = await supabase
    .from("media_variants")
    .upsert(variants, { onConflict: "asset_id,variant" });

  if (variantError) {
    throw new Error(`Media variant seed failed: ${variantError.message}`);
  }
}

async function upsertContentEntries(kind, entries) {
  for (const entry of entries) {
    const { error } = await supabase.rpc("save_content_entry_with_relations", {
      entry_row: {
        body_json: paragraphBody(entry.bodyText),
        body_text: entry.bodyText,
        display_date: entry.displayDate,
        id: entry.id,
        kind,
        published_at: today,
        related_product_slug: null,
        slug: entry.slug,
        status: "published",
        summary: entry.summary,
        title: entry.title,
        updated_at: now,
      },
      media_usage_rows: entry.assetId
        ? [
            {
              alt_override: null,
              asset_id: entry.assetId,
              caption_override: null,
              layout: "default",
              role: "cover",
              sort_order: 0,
            },
            {
              alt_override: null,
              asset_id: entry.assetId,
              caption_override: null,
              layout: "default",
              role: "list",
              sort_order: 0,
            },
            {
              alt_override: null,
              asset_id: entry.assetId,
              caption_override: null,
              layout: "default",
              role: "detail",
              sort_order: 0,
            },
          ]
        : [],
      reserved_asset_rows: [],
    });

    if (error) {
      throw new Error(`${kind} entry seed failed (${entry.slug}): ${error.message}`);
    }
  }
}

async function upsertClassReviews(reviews) {
  const { error } = await supabase.from("class_reviews").upsert(
    reviews.map((review) => ({
      body: review.body,
      class_title: review.classTitle,
      created_at: now,
      display_name: review.displayName,
      id: review.id,
      marketing_consent: false,
      participant_name: review.displayName,
      status: "published",
      updated_at: now,
    })),
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Class review seed failed: ${error.message}`);
  }
}

function paragraphBody(text) {
  return {
    root: {
      children: text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => ({
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: paragraph,
              type: "text",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        })),
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

async function loadEnvFile(filePath) {
  let source;

  try {
    source = await readFile(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
