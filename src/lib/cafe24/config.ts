import "server-only";

export type Cafe24Config = {
  accessToken: string;
  apiBaseUrl: string;
  apiVersion: string;
  defaultCategoryNo: number | null;
  defaultDisplayGroup: number;
  mallId: string;
  shopBaseUrl: string | null;
  shopNo: number;
};

export class Cafe24ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Cafe24ConfigError";
  }
}

export function getCafe24Config(): Cafe24Config {
  const mallId = requiredEnv("CAFE24_MALL_ID");
  const accessToken = requiredEnv("CAFE24_ACCESS_TOKEN");
  const apiBaseUrl =
    process.env.CAFE24_API_BASE_URL ||
    `https://${mallId}.cafe24api.com/api/v2/admin`;

  return {
    accessToken,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    apiVersion: process.env.CAFE24_API_VERSION || "2025-09-01",
    defaultCategoryNo: optionalNumber("CAFE24_DEFAULT_CATEGORY_NO"),
    defaultDisplayGroup: optionalNumber("CAFE24_DEFAULT_DISPLAY_GROUP") ?? 1,
    mallId,
    shopBaseUrl:
      process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL ||
      `https://${mallId}.cafe24.com`,
    shopNo: optionalNumber("CAFE24_SHOP_NO") ?? 1,
  };
}

export function getCafe24ConfigStatus() {
  return {
    accessToken: Boolean(process.env.CAFE24_ACCESS_TOKEN),
    mallId: Boolean(process.env.CAFE24_MALL_ID),
  };
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Cafe24ConfigError(`${name} 환경 변수가 필요합니다.`);
  }

  return value;
}

function optionalNumber(name: string) {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Cafe24ConfigError(`${name} 값은 숫자여야 합니다.`);
  }

  return parsed;
}
