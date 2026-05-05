import "server-only";

import type { Cafe24ProductMapping, ConsepotProduct } from "@/lib/shop";
import { cafe24Fetch } from "./client";
import { getCafe24Config } from "./config";

type Cafe24ProductPayload = {
  add_category_no?: Array<{
    category_no: number;
    new: "F" | "T";
    recommend: "F" | "T";
  }>;
  custom_product_code: string;
  description: string;
  display: "F" | "T";
  has_option: "F";
  mobile_description: string;
  price: number;
  product_condition: "N";
  product_material?: string;
  product_name: string;
  selling: "F" | "T";
  shop_no: number;
  shipping_info?: string;
  simple_description: string;
  soldout_message: string;
  summary_description: string;
  supply_price: number;
};

type Cafe24VariantInventoryPayload = {
  display_soldout: "F" | "T";
  important_inventory: "A";
  inventory_control_type: "B";
  quantity: number;
  shop_no: number;
  use_inventory: "T";
};

export async function syncProductToCafe24(product: ConsepotProduct) {
  const config = getCafe24Config();
  const categoryNo = product.cafe24.categoryNo ?? config.defaultCategoryNo;
  const displayGroup =
    product.cafe24.displayGroup ?? config.defaultDisplayGroup;
  const request = toCafe24ProductPayload(product, {
    categoryNo,
    shopNo: config.shopNo,
  });

  let productResponse: unknown;
  let productNo = product.cafe24.productNo;

  if (productNo) {
    productResponse = await cafe24Fetch(
      config,
      `/products/${encodeURIComponent(productNo)}`,
      {
        body: { request },
        method: "PUT",
      },
    );
  } else {
    productResponse = await cafe24Fetch(config, "/products", {
      body: { request },
      method: "POST",
    });
    productNo = extractProductNo(productResponse);
  }

  if (!productNo) {
    throw new Error("Cafe24 응답에서 상품번호를 확인하지 못했습니다.");
  }

  const variantCode =
    product.cafe24.variantCode ??
    extractVariantCode(productResponse) ??
    (await retrievePrimaryVariantCode(productNo));

  if (variantCode && product.commerce.stockQuantity !== null) {
    await syncVariantInventory(productNo, variantCode, product);
  }

  const now = new Date().toISOString();
  const productUrl = buildCafe24ProductUrl({
    baseUrl: config.shopBaseUrl,
    categoryNo,
    displayGroup,
    productNo,
  });

  return {
    ...product.cafe24,
    categoryNo: categoryNo ?? undefined,
    displayGroup,
    lastSyncError: undefined,
    lastSyncedAt: now,
    mappingStatus: "mapped",
    productNo,
    productUrl,
    variantCode: variantCode ?? product.cafe24.variantCode,
  } satisfies Cafe24ProductMapping;
}

function toCafe24ProductPayload(
  product: ConsepotProduct,
  options: { categoryNo: number | null; shopNo: number },
): Cafe24ProductPayload {
  if (product.commerce.price === null) {
    throw new Error("Cafe24 동기화에는 가격 입력이 필요합니다.");
  }

  const selling = product.commerce.availabilityStatus === "available" ? "T" : "F";
  const display = product.published ? "T" : "F";
  const description = buildCafe24Description(product);
  const category = options.categoryNo
    ? [
        {
          category_no: options.categoryNo,
          new: "F" as const,
          recommend: "F" as const,
        },
      ]
    : undefined;

  return {
    add_category_no: category,
    custom_product_code: product.slug.slice(0, 40),
    description,
    display,
    has_option: "F",
    mobile_description: description,
    price: product.commerce.price,
    product_condition: "N",
    product_material: product.material,
    product_name: product.titleKo,
    selling,
    shop_no: options.shopNo,
    shipping_info: product.shippingNote,
    simple_description: product.shortDescription,
    soldout_message: "판매 완료",
    summary_description: product.shortDescription.slice(0, 255),
    supply_price: product.commerce.price,
  };
}

async function retrievePrimaryVariantCode(productNo: string) {
  const config = getCafe24Config();
  const payload = await cafe24Fetch(config, `/products/${productNo}/variants`, {
    searchParams: {
      shop_no: config.shopNo,
    },
  });

  return extractVariantCode(payload);
}

async function syncVariantInventory(
  productNo: string,
  variantCode: string,
  product: ConsepotProduct,
) {
  const config = getCafe24Config();
  const request: Cafe24VariantInventoryPayload = {
    display_soldout: "T",
    important_inventory: "A",
    inventory_control_type: "B",
    quantity: product.commerce.stockQuantity ?? 0,
    shop_no: config.shopNo,
    use_inventory: "T",
  };

  await cafe24Fetch(
    config,
    `/products/${productNo}/variants/${variantCode}/inventories`,
    {
      body: { request },
      method: "PUT",
    },
  );
}

function buildCafe24Description(product: ConsepotProduct) {
  const lines = [
    product.shortDescription,
    product.story,
    product.size ? `크기: ${product.size}` : null,
    product.material ? `소재: ${product.material}` : null,
    product.glaze ? `유약: ${product.glaze}` : null,
    product.usageNote ? `사용 안내: ${product.usageNote}` : null,
    product.careNote ? `관리 안내: ${product.careNote}` : null,
  ].filter(Boolean);

  return lines.map((line) => `<p>${escapeHtml(String(line))}</p>`).join("");
}

function buildCafe24ProductUrl(options: {
  baseUrl: string | null;
  categoryNo: number | null;
  displayGroup: number;
  productNo: string;
}) {
  if (!options.baseUrl) {
    return `/product/detail.html?product_no=${options.productNo}`;
  }

  const url = new URL("/product/detail.html", options.baseUrl);
  url.searchParams.set("product_no", options.productNo);

  if (options.categoryNo) {
    url.searchParams.set("cate_no", String(options.categoryNo));
  }

  url.searchParams.set("display_group", String(options.displayGroup));
  return url.toString();
}

function extractProductNo(payload: unknown): string | null {
  const product = extractObject(payload, "product");

  if (product) {
    const value = product.product_no ?? product.productNo;
    return value ? String(value) : null;
  }

  if (typeof payload === "object" && payload !== null && "product_no" in payload) {
    return String(payload.product_no);
  }

  return null;
}

function extractVariantCode(payload: unknown): string | null {
  const variant = extractFirstVariant(payload);

  if (!variant) {
    return null;
  }

  const value = variant.variant_code ?? variant.variantCode;
  return value ? String(value) : null;
}

function extractFirstVariant(payload: unknown): Record<string, unknown> | null {
  const product = extractObject(payload, "product");

  if (product && Array.isArray(product.variants) && product.variants[0]) {
    return product.variants[0] as Record<string, unknown>;
  }

  const variants = extractArray(payload, "variants");

  if (variants?.[0]) {
    return variants[0] as Record<string, unknown>;
  }

  return null;
}

function extractObject(payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function extractArray(payload: unknown, key: string) {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
