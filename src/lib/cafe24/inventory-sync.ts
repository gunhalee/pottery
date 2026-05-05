import "server-only";

import {
  appendProductSyncLog,
  readProducts,
  updateProductInventory,
  type ConsepotProduct,
} from "@/lib/shop";
import { cafe24Fetch } from "./client";
import { getCafe24Config } from "./config";

type Cafe24InventoryPayload = {
  display_soldout?: "F" | "T";
  important_inventory?: "A" | "B";
  inventory_control_type?: "A" | "B";
  quantity?: number | string;
  safety_inventory?: number | string;
  use_inventory?: "F" | "T";
};

export type Cafe24InventorySyncResult = {
  afterQuantity: number | null;
  beforeQuantity: number | null;
  message: string;
  productId: string;
  productNo: string | null;
  slug: string;
  status: "failed" | "skipped" | "unchanged" | "updated";
  variantCode: string | null;
};

export type Cafe24InventorySyncSummary = {
  checked: number;
  failed: number;
  results: Cafe24InventorySyncResult[];
  skipped: number;
  unchanged: number;
  updated: number;
};

export async function syncCafe24InventoryForMappedProducts() {
  const products = await readProducts();
  const mappedProducts = products.filter(isCafe24InventorySyncCandidate);
  const results: Cafe24InventorySyncResult[] = [];

  for (const product of mappedProducts) {
    results.push(await syncCafe24InventoryForProduct(product));
  }

  return summarizeInventorySync(results);
}

export async function syncCafe24InventoryForProduct(
  product: ConsepotProduct,
): Promise<Cafe24InventorySyncResult> {
  const productNo = product.cafe24.productNo;
  const variantCode = product.cafe24.variantCode ?? null;

  if (!productNo || !variantCode) {
    return {
      afterQuantity: product.commerce.stockQuantity,
      beforeQuantity: product.commerce.stockQuantity,
      message: "Cafe24 상품번호 또는 품목코드가 없어 건너뜁니다.",
      productId: product.id,
      productNo,
      slug: product.slug,
      status: "skipped",
      variantCode,
    };
  }

  try {
    const inventory = await retrieveCafe24VariantInventory(productNo, variantCode);
    const nextQuantity = normalizeQuantity(inventory.quantity);
    const nextAvailabilityStatus = resolveAvailabilityStatus(product, nextQuantity);
    const changed =
      product.commerce.stockQuantity !== nextQuantity ||
      product.commerce.availabilityStatus !== nextAvailabilityStatus;

    if (changed) {
      await updateProductInventory(product.id, {
        availabilityStatus: nextAvailabilityStatus,
        stockQuantity: nextQuantity,
      });
    }

    await appendProductSyncLog({
      action: "sync",
      message: changed
        ? `Cafe24 재고를 ${nextQuantity}개로 동기화했습니다.`
        : `Cafe24 재고 ${nextQuantity}개와 일치합니다.`,
      productId: product.id,
      requestPayload: {
        productNo,
        variantCode,
      },
      responsePayload: inventory,
      status: "success",
    });

    return {
      afterQuantity: nextQuantity,
      beforeQuantity: product.commerce.stockQuantity,
      message: changed ? "재고를 갱신했습니다." : "이미 최신 재고입니다.",
      productId: product.id,
      productNo,
      slug: product.slug,
      status: changed ? "updated" : "unchanged",
      variantCode,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Cafe24 재고 동기화 중 알 수 없는 오류가 발생했습니다.";

    await appendProductSyncLog({
      action: "sync",
      message,
      productId: product.id,
      requestPayload: {
        productNo,
        variantCode,
      },
      status: "failed",
    });

    return {
      afterQuantity: product.commerce.stockQuantity,
      beforeQuantity: product.commerce.stockQuantity,
      message,
      productId: product.id,
      productNo,
      slug: product.slug,
      status: "failed",
      variantCode,
    };
  }
}

async function retrieveCafe24VariantInventory(
  productNo: string,
  variantCode: string,
) {
  const config = await getCafe24Config();
  const payload = await cafe24Fetch(
    config,
    `/products/${encodeURIComponent(productNo)}/variants/${encodeURIComponent(
      variantCode,
    )}/inventories`,
    {
      searchParams: {
        shop_no: config.shopNo,
      },
    },
  );

  return extractCafe24Inventory(payload);
}

function extractCafe24Inventory(payload: unknown): Cafe24InventoryPayload {
  if (isInventoryPayload(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Cafe24 재고 응답 형식을 확인하지 못했습니다.");
  }

  const record = payload as Record<string, unknown>;
  const inventory = record.inventory;

  if (isInventoryPayload(inventory)) {
    return inventory;
  }

  const inventories = record.inventories;

  if (Array.isArray(inventories) && isInventoryPayload(inventories[0])) {
    return inventories[0];
  }

  throw new Error("Cafe24 재고 응답에서 quantity를 찾지 못했습니다.");
}

function isInventoryPayload(value: unknown): value is Cafe24InventoryPayload {
  return typeof value === "object" && value !== null && "quantity" in value;
}

function normalizeQuantity(value: Cafe24InventoryPayload["quantity"]) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Cafe24 재고 수량이 올바르지 않습니다.");
  }

  return Math.floor(quantity);
}

function resolveAvailabilityStatus(
  product: ConsepotProduct,
  quantity: number,
): ConsepotProduct["commerce"]["availabilityStatus"] {
  if (
    product.commerce.availabilityStatus !== "available" &&
    product.commerce.availabilityStatus !== "sold_out"
  ) {
    return product.commerce.availabilityStatus;
  }

  return quantity > 0 ? "available" : "sold_out";
}

function isCafe24InventorySyncCandidate(product: ConsepotProduct) {
  return Boolean(
    product.cafe24.productNo &&
      product.cafe24.variantCode &&
      product.cafe24.mappingStatus === "mapped",
  );
}

function summarizeInventorySync(
  results: Cafe24InventorySyncResult[],
): Cafe24InventorySyncSummary {
  return {
    checked: results.length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
    skipped: results.filter((result) => result.status === "skipped").length,
    unchanged: results.filter((result) => result.status === "unchanged").length,
    updated: results.filter((result) => result.status === "updated").length,
  };
}
