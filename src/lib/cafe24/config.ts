import "server-only";

import { getCafe24AccessToken, hasCafe24AccessToken } from "./oauth";

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

export async function getCafe24Config(): Promise<Cafe24Config> {
  const mallId = requiredEnv("CAFE24_MALL_ID");
  const accessToken = await getCafe24AccessToken();
  const apiBaseUrl =
    process.env.CAFE24_API_BASE_URL ||
    `https://${mallId}.cafe24api.com/api/v2/admin`;

  return {
    accessToken,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    apiVersion: process.env.CAFE24_API_VERSION || "2026-03-01",
    defaultCategoryNo: optionalNumber("CAFE24_DEFAULT_CATEGORY_NO"),
    defaultDisplayGroup: optionalNumber("CAFE24_DEFAULT_DISPLAY_GROUP") ?? 1,
    mallId,
    shopBaseUrl:
      process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL ||
      `https://${mallId}.cafe24.com`,
    shopNo: optionalNumber("CAFE24_SHOP_NO") ?? 1,
  };
}

export async function getCafe24ConfigStatus() {
  return {
    accessToken: await hasCafe24AccessToken(),
    clientId: Boolean(process.env.CAFE24_CLIENT_ID),
    clientSecret: Boolean(process.env.CAFE24_CLIENT_SECRET),
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
