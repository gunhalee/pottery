import "server-only";

import type { ConsepotProduct } from "@/lib/shop";
import { Cafe24ApiError, cafe24Fetch } from "./client";
import { Cafe24ConfigError, getCafe24Config } from "./config";

type Cafe24ProductRecord = Record<string, unknown>;
type Cafe24VariantRecord = Record<string, unknown>;
type Cafe24InventoryRecord = Record<string, unknown>;

export type Cafe24PurchaseStatusCode =
  | "error"
  | "not_configured"
  | "ready"
  | "unavailable";

export type Cafe24PurchaseStatus = {
  canPurchase: boolean;
  checkedAt: string;
  display: boolean | null;
  errorMessage?: string;
  inventoryManaged: boolean | null;
  maxQuantity: number;
  messages: string[];
  price: number | null;
  priceMatches: boolean | null;
  productFound: boolean;
  productName: string | null;
  productNo: string | null;
  quantity: number | null;
  selling: boolean | null;
  status: Cafe24PurchaseStatusCode;
  variantCode: string | null;
  variantDisplay: boolean | null;
  variantFound: boolean;
  variantSelling: boolean | null;
};

export type Cafe24ReadinessCheck = {
  id: string;
  label: string;
  message: string;
  status: "danger" | "ok" | "warning";
};

export type Cafe24ProductReadiness = {
  checks: Cafe24ReadinessCheck[];
  purchaseStatus: Cafe24PurchaseStatus;
  ready: boolean;
};

type PurchaseStatusOptions = {
  cache?: boolean;
};

const purchaseStatusCacheTtlMs = 30_000;
const purchaseStatusCacheMaxEntries = 200;
const purchaseStatusCache = new Map<
  string,
  {
    expiresAt: number;
    promise: Promise<Cafe24PurchaseStatus>;
  }
>();

export async function getCafe24ProductPurchaseStatus(
  product: ConsepotProduct,
  options: PurchaseStatusOptions = {},
): Promise<Cafe24PurchaseStatus> {
  if (options.cache === false) {
    return readCafe24ProductPurchaseStatus(product);
  }

  const cacheKey = getPurchaseStatusCacheKey(product);
  const now = Date.now();
  const cached = purchaseStatusCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = readCafe24ProductPurchaseStatus(product);
  purchaseStatusCache.set(cacheKey, {
    expiresAt: now + purchaseStatusCacheTtlMs,
    promise,
  });
  prunePurchaseStatusCache(now);

  promise.catch(() => {
    if (purchaseStatusCache.get(cacheKey)?.promise === promise) {
      purchaseStatusCache.delete(cacheKey);
    }
  });

  return promise;
}

async function readCafe24ProductPurchaseStatus(
  product: ConsepotProduct,
): Promise<Cafe24PurchaseStatus> {
  const productNo = product.cafe24.productNo?.trim() || null;
  const variantCode = product.cafe24.variantCode?.trim() || null;
  const localMaxQuantity = getLocalMaxQuantity(product);

  if (!productNo || !variantCode || product.commerce.price === null) {
    return {
      canPurchase: false,
      checkedAt: new Date().toISOString(),
      display: null,
      inventoryManaged: null,
      maxQuantity: localMaxQuantity,
      messages: [
        !productNo ? "Cafe24 상품번호가 없습니다." : null,
        !variantCode ? "Cafe24 품목코드가 없습니다." : null,
        product.commerce.price === null ? "상품 가격이 없습니다." : null,
      ].filter((message): message is string => Boolean(message)),
      price: null,
      priceMatches: null,
      productFound: false,
      productName: null,
      productNo,
      quantity: null,
      selling: null,
      status: "not_configured",
      variantCode,
      variantDisplay: null,
      variantFound: false,
      variantSelling: null,
    };
  }

  try {
    const config = await getCafe24Config();
    const [productRecord, variantRecord, inventoryRecord] = await Promise.all([
      retrieveProduct(productNo, config),
      retrieveVariant(productNo, variantCode, config),
      retrieveInventory(productNo, variantCode, config),
    ]);

    return normalizePurchaseStatus({
      inventoryRecord,
      localMaxQuantity,
      localPrice: product.commerce.price,
      productNo,
      productRecord,
      variantCode,
      variantRecord,
    });
  } catch (error) {
    return {
      canPurchase: false,
      checkedAt: new Date().toISOString(),
      display: null,
      errorMessage: extractStatusErrorMessage(error),
      inventoryManaged: null,
      maxQuantity: localMaxQuantity,
      messages: [extractStatusErrorMessage(error)],
      price: null,
      priceMatches: null,
      productFound: false,
      productName: null,
      productNo,
      quantity: null,
      selling: null,
      status: "error",
      variantCode,
      variantDisplay: null,
      variantFound: false,
      variantSelling: null,
    };
  }
}

export async function buildCafe24ProductReadiness(
  product: ConsepotProduct,
): Promise<Cafe24ProductReadiness> {
  const purchaseStatus = await getCafe24ProductPurchaseStatus(product, {
    cache: false,
  });
  const checks = buildReadinessChecks(product, purchaseStatus);

  return {
    checks,
    purchaseStatus,
    ready: checks.every((check) => check.status === "ok"),
  };
}

async function retrieveProduct(
  productNo: string,
  config: Awaited<ReturnType<typeof getCafe24Config>>,
) {
  const payload = await cafe24Fetch(config, `/products/${encodeURIComponent(productNo)}`, {
    searchParams: {
      shop_no: config.shopNo,
    },
  });

  return extractRecord(payload, "product");
}

async function retrieveVariant(
  productNo: string,
  variantCode: string,
  config: Awaited<ReturnType<typeof getCafe24Config>>,
) {
  const payload = await cafe24Fetch(
    config,
    `/products/${encodeURIComponent(productNo)}/variants/${encodeURIComponent(
      variantCode,
    )}`,
    {
      searchParams: {
        shop_no: config.shopNo,
      },
    },
  );

  return extractRecord(payload, "variant");
}

async function retrieveInventory(
  productNo: string,
  variantCode: string,
  config: Awaited<ReturnType<typeof getCafe24Config>>,
) {
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

  return extractRecord(payload, "inventory");
}

function normalizePurchaseStatus({
  inventoryRecord,
  localMaxQuantity,
  localPrice,
  productNo,
  productRecord,
  variantCode,
  variantRecord,
}: {
  inventoryRecord: Cafe24InventoryRecord | null;
  localMaxQuantity: number;
  localPrice: number;
  productNo: string;
  productRecord: Cafe24ProductRecord | null;
  variantCode: string;
  variantRecord: Cafe24VariantRecord | null;
}): Cafe24PurchaseStatus {
  const display = flagToBoolean(productRecord?.display);
  const selling = flagToBoolean(productRecord?.selling);
  const variantDisplay = flagToBoolean(variantRecord?.display);
  const variantSelling = flagToBoolean(variantRecord?.selling);
  const inventoryManaged = flagToBoolean(
    inventoryRecord?.use_inventory ?? variantRecord?.use_inventory,
  );
  const quantity = numberOrNull(inventoryRecord?.quantity);
  const price = numberOrNull(productRecord?.price);
  const priceMatches = price === null ? null : price === localPrice;
  const maxQuantity =
    inventoryManaged === false || quantity === null
      ? localMaxQuantity
      : Math.max(0, Math.min(localMaxQuantity, Math.floor(quantity)));
  const messages = [
    productRecord ? null : "Cafe24 상품을 찾지 못했습니다.",
    variantRecord ? null : "Cafe24 품목을 찾지 못했습니다.",
    display === false ? "Cafe24 상품이 진열중이 아닙니다." : null,
    selling === false ? "Cafe24 상품이 판매중이 아닙니다." : null,
    variantDisplay === false ? "Cafe24 품목이 진열중이 아닙니다." : null,
    variantSelling === false ? "Cafe24 품목이 판매중이 아닙니다." : null,
    inventoryManaged !== false && quantity !== null && quantity < 1
      ? "Cafe24 재고가 없습니다."
      : null,
    priceMatches === false ? "Consepot 가격과 Cafe24 가격이 다릅니다." : null,
  ].filter((message): message is string => Boolean(message));
  const canPurchase =
    Boolean(productRecord) &&
    Boolean(variantRecord) &&
    display !== false &&
    selling !== false &&
    variantDisplay !== false &&
    variantSelling !== false &&
    (inventoryManaged === false || quantity === null || quantity > 0);

  return {
    canPurchase,
    checkedAt: new Date().toISOString(),
    display,
    inventoryManaged,
    maxQuantity: Math.max(1, maxQuantity),
    messages,
    price,
    priceMatches,
    productFound: Boolean(productRecord),
    productName: stringOrNull(productRecord?.product_name),
    productNo,
    quantity,
    selling,
    status: canPurchase ? "ready" : "unavailable",
    variantCode,
    variantDisplay,
    variantFound: Boolean(variantRecord),
    variantSelling,
  };
}

function buildReadinessChecks(
  product: ConsepotProduct,
  status: Cafe24PurchaseStatus,
): Cafe24ReadinessCheck[] {
  return [
    {
      id: "mapping",
      label: "매핑",
      message:
        product.cafe24.productNo && product.cafe24.variantCode
          ? `상품 ${product.cafe24.productNo}, 품목 ${product.cafe24.variantCode}`
          : "상품번호와 품목코드가 모두 필요합니다.",
      status:
        product.cafe24.productNo && product.cafe24.variantCode ? "ok" : "danger",
    },
    {
      id: "api",
      label: "Cafe24 조회",
      message: status.productFound
        ? "Cafe24 상품 조회에 성공했습니다."
        : status.errorMessage ?? "Cafe24 상품을 확인하지 못했습니다.",
      status: status.productFound ? "ok" : "danger",
    },
    {
      id: "variant",
      label: "품목",
      message: status.variantFound
        ? "품목코드가 Cafe24 상품과 연결되어 있습니다."
        : "품목코드를 확인하지 못했습니다.",
      status: status.variantFound ? "ok" : "danger",
    },
    {
      id: "selling",
      label: "판매 상태",
      message:
        status.display !== false &&
        status.selling !== false &&
        status.variantDisplay !== false &&
        status.variantSelling !== false
          ? "진열/판매 상태가 구매 가능으로 보입니다."
          : status.messages.find((message) => message.includes("진열")) ??
            status.messages.find((message) => message.includes("판매")) ??
            "진열/판매 상태 확인이 필요합니다.",
      status:
        status.display !== false &&
        status.selling !== false &&
        status.variantDisplay !== false &&
        status.variantSelling !== false
          ? "ok"
          : "danger",
    },
    {
      id: "stock",
      label: "재고",
      message:
        status.inventoryManaged === false
          ? "Cafe24 재고 관리 미사용 상품입니다."
          : status.quantity === null
            ? "재고 수량을 확인하지 못했습니다."
            : `Cafe24 재고 ${status.quantity}개`,
      status:
        status.inventoryManaged === false ||
        status.quantity === null ||
        status.quantity > 0
          ? "ok"
          : "danger",
    },
    {
      id: "price",
      label: "가격",
      message:
        status.priceMatches === true
          ? "Consepot 가격과 Cafe24 가격이 일치합니다."
          : status.price === null
            ? "Cafe24 가격을 확인하지 못했습니다."
            : `Cafe24 ${status.price.toLocaleString("ko-KR")}원 / Consepot ${
                product.commerce.price?.toLocaleString("ko-KR") ?? "미입력"
              }원`,
      status:
        status.priceMatches === true
          ? "ok"
          : status.priceMatches === false
            ? "warning"
            : "danger",
    },
    {
      id: "category",
      label: "카테고리",
      message: product.cafe24.categoryNo
        ? `카테고리 ${product.cafe24.categoryNo}`
        : "Cafe24 카테고리 번호가 필요합니다.",
      status: product.cafe24.categoryNo ? "ok" : "warning",
    },
  ];
}

function extractRecord(payload: unknown, key: string): Record<string, unknown> | null {
  if (isRecord(payload)) {
    if (isRecord(payload[key])) {
      return payload[key] as Record<string, unknown>;
    }

    if (Array.isArray(payload[key]) && isRecord(payload[key]?.[0])) {
      return payload[key][0] as Record<string, unknown>;
    }
  }

  return isRecord(payload) ? payload : null;
}

function flagToBoolean(value: unknown) {
  if (value === "T" || value === true) {
    return true;
  }

  if (value === "F" || value === false) {
    return false;
  }

  return null;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getLocalMaxQuantity(product: ConsepotProduct) {
  const stockQuantity = product.commerce.stockQuantity;
  return stockQuantity && stockQuantity > 0 ? stockQuantity : 99;
}

function extractStatusErrorMessage(error: unknown) {
  if (error instanceof Cafe24ApiError || error instanceof Cafe24ConfigError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Cafe24 상품 상태를 확인하지 못했습니다.";
}

function getPurchaseStatusCacheKey(product: ConsepotProduct) {
  return [
    product.slug,
    product.cafe24.productNo?.trim() ?? "",
    product.cafe24.variantCode?.trim() ?? "",
    product.commerce.price ?? "",
    getLocalMaxQuantity(product),
  ].join(":");
}

function prunePurchaseStatusCache(now: number) {
  for (const [key, entry] of purchaseStatusCache) {
    if (entry.expiresAt <= now) {
      purchaseStatusCache.delete(key);
    }
  }

  while (purchaseStatusCache.size > purchaseStatusCacheMaxEntries) {
    const oldestKey = purchaseStatusCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    purchaseStatusCache.delete(oldestKey);
  }
}
