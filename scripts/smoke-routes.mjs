import { startNextServer } from "./smoke-lib.mjs";

const port = Number(process.env.SMOKE_PORT ?? 3012);

const routeChecks = [
  { path: "/", status: 200 },
  { path: "/shop", status: 200 },
  { path: "/gallery", status: 200 },
  { path: "/news", status: 200 },
  {
    locationPrefix: "/admin/login",
    path: "/admin/products",
    status: 307,
  },
  {
    locationPrefix: "/admin/login",
    path: "/admin/gallery",
    status: 307,
  },
  {
    locationPrefix: "/admin/login",
    path: "/admin/news",
    status: 307,
  },
];

const app = startNextServer(port);

try {
  await app.wait();
  await runChecks(app.baseUrl);
  console.log(`Route smoke passed for ${app.baseUrl}`);
} finally {
  app.stop();
}

async function runChecks(baseUrl) {
  const failures = [];

  for (const check of routeChecks) {
    const response = await fetch(`${baseUrl}${check.path}`, {
      redirect: "manual",
    });
    const location = response.headers.get("location") ?? "";
    const locationMatches =
      !check.locationPrefix || location.startsWith(check.locationPrefix);

    if (response.status !== check.status || !locationMatches) {
      failures.push(
        `${check.path}: expected ${check.status}${
          check.locationPrefix ? ` -> ${check.locationPrefix}` : ""
        }, got ${response.status}${location ? ` -> ${location}` : ""}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Route smoke failed:\n${failures.join("\n")}`);
  }

  await verifyFirstDetail(baseUrl, "/shop", "/shop/", "product-detail-shell");
  await verifyFirstDetail(baseUrl, "/gallery", "/gallery/", "content-detail");
  await verifyFirstDetail(baseUrl, "/news", "/news/", "content-detail");
}

async function verifyFirstDetail(
  baseUrl,
  listPath,
  detailPrefix,
  expectedMarker,
) {
  const listResponse = await fetch(`${baseUrl}${listPath}`, {
    redirect: "manual",
  });
  const listHtml = await listResponse.text();
  const href = findFirstHref(listHtml, detailPrefix);

  if (!href) {
    return;
  }

  const detailResponse = await fetch(`${baseUrl}${href}`, {
    redirect: "manual",
  });
  const detailHtml = await detailResponse.text();

  if (
    detailResponse.status !== 200 ||
    !detailHtml.includes(expectedMarker)
  ) {
    throw new Error(
      `${href}: expected public detail marker ${expectedMarker}, got ${detailResponse.status}`,
    );
  }
}

function findFirstHref(html, prefix) {
  const pattern = /href="([^"]+)"/g;
  const ignoredHrefs = new Set(["/shop/cart", "/shop/wishlist"]);

  for (const match of html.matchAll(pattern)) {
    const href = decodeHtml(match[1] ?? "");

    if (
      href.startsWith(prefix) &&
      href !== prefix.slice(0, -1) &&
      !ignoredHrefs.has(href)
    ) {
      return href;
    }
  }

  return null;
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x2F;", "/");
}
