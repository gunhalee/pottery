import { NextResponse } from "next/server";
import { studioLocation } from "@/lib/config/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const staticMapEndpoint =
  "https://naveropenapi.apigw.ntruss.com/map-static/v2/raster";
const defaultWidth = 900;
const defaultHeight = 520;
const maxSize = 1024;

export async function GET(request: Request) {
  const keyId = getNaverStaticMapKeyId();
  const key = getNaverStaticMapKey();

  if (!keyId || !key) {
    return createMapPlaceholder("Naver Static Map API key is not configured.");
  }

  const url = new URL(request.url);
  const width = readImageSize(url.searchParams.get("w"), defaultWidth);
  const height = readImageSize(url.searchParams.get("h"), defaultHeight);
  const longitude = readCoordinate(
    url.searchParams.get("lng"),
    studioLocation.longitude,
  );
  const latitude = readCoordinate(
    url.searchParams.get("lat"),
    studioLocation.latitude,
  );
  const staticMapUrl = new URL(staticMapEndpoint);

  staticMapUrl.searchParams.set("w", String(width));
  staticMapUrl.searchParams.set("h", String(height));
  staticMapUrl.searchParams.set("center", `${longitude},${latitude}`);
  staticMapUrl.searchParams.set("level", "16");
  staticMapUrl.searchParams.set("format", "png");
  staticMapUrl.searchParams.set("scale", "2");
  staticMapUrl.searchParams.set("lang", "ko");
  staticMapUrl.searchParams.append(
    "markers",
    `type:d|size:mid|color:Default|pos:${longitude} ${latitude}`,
  );

  try {
    const mapResponse = await fetch(staticMapUrl, {
      headers: {
        "X-NCP-APIGW-API-KEY": key,
        "X-NCP-APIGW-API-KEY-ID": keyId,
      },
      next: {
        revalidate: 60 * 60 * 24,
      },
    });

    if (!mapResponse.ok) {
      return createMapPlaceholder(`Naver Static Map API returned ${mapResponse.status}.`);
    }

    const image = await mapResponse.arrayBuffer();
    const contentType = mapResponse.headers.get("content-type") || "image/png";

    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": contentType,
      },
    });
  } catch {
    return createMapPlaceholder("Naver Static Map API request failed.");
  }
}

function getNaverStaticMapKeyId() {
  return (
    process.env.NAVER_MAPS_API_KEY_ID ||
    process.env.NAVER_MAPS_CLIENT_ID ||
    process.env.NAVER_MAPS_NCP_KEY_ID ||
    process.env.NCP_MAPS_API_KEY_ID ||
    process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID ||
    process.env.NEXT_PUBLIC_NAVER_MAPS_KEY_ID ||
    process.env.NEXT_PUBLIC_NAVER_MAPS_NCP_KEY_ID ||
    ""
  ).trim();
}

function getNaverStaticMapKey() {
  return (
    process.env.NAVER_MAPS_API_KEY ||
    process.env.NAVER_MAPS_CLIENT_SECRET ||
    process.env.NAVER_MAPS_NCP_KEY ||
    process.env.NCP_MAPS_API_KEY ||
    ""
  ).trim();
}

function readImageSize(value: string | null, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(numberValue), 1), maxSize);
}

function readCoordinate(value: string | null, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function createMapPlaceholder(message: string) {
  return new NextResponse(createPlaceholderSvg(message), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
    status: 200,
  });
}

function createPlaceholderSvg(message: string) {
  const escapedMessage = escapeXml(message);
  const escapedName = escapeXml(studioLocation.name);
  const escapedAddress = escapeXml(studioLocation.address);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520" role="img" aria-labelledby="title desc">
  <title id="title">${escapedName} 위치 지도</title>
  <desc id="desc">${escapedAddress}</desc>
  <rect width="900" height="520" fill="#f4f4f3"/>
  <path d="M0 520L900 0" stroke="#dededa" stroke-width="1"/>
  <circle cx="450" cy="236" r="18" fill="#111111"/>
  <path d="M450 270c34-48 58-82 58-118 0-32-26-58-58-58s-58 26-58 58c0 36 24 70 58 118z" fill="#111111" opacity=".9"/>
  <circle cx="450" cy="152" r="18" fill="#ffffff"/>
  <text x="450" y="332" fill="#111111" font-family="Arial, sans-serif" font-size="28" text-anchor="middle">${escapedName}</text>
  <text x="450" y="370" fill="#555552" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">${escapedAddress}</text>
  <text x="450" y="416" fill="#9a9a94" font-family="Arial, sans-serif" font-size="14" text-anchor="middle">${escapedMessage}</text>
</svg>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
