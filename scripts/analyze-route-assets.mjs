#!/usr/bin/env node

const defaultRouteSeeds = [
  "/",
  "/shop",
  "/shop/cart",
  "/checkout",
  "/order/lookup",
  "/gallery",
  "/news",
  "/class",
];

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.base ?? "http://localhost:3002";
const routes = args.routes ?? (await resolveDefaultRoutes(baseUrl));
const shouldFetchImages = Boolean(args.fetchImages);
const outputPath = args.output;
const budgetPath = args.budget;

const results = [];

for (const route of routes) {
  const pageUrl = new URL(route, baseUrl);
  const htmlResponse = await fetchWithSize(pageUrl);
  const html = htmlResponse.text ?? "";
  const resources = extractResources(html, pageUrl);
  const css = await fetchResourceGroup(resources.css);
  const js = await fetchResourceGroup(resources.js);
  const imageResources = uniqueUrls(resources.images);
  const imageCandidates = uniqueUrls(resources.imageCandidates);
  const images = shouldFetchImages
    ? await fetchResourceGroup(imageResources, { tolerateErrors: true })
    : { bytes: 0, errors: [], items: [] };
  const variants = summarizeImageVariants(imageCandidates);

  results.push({
    eagerImageCount: resources.eagerImageCount,
    highPriorityImageCount: resources.highPriorityImageCount,
    route,
    htmlBytes: htmlResponse.bytes,
    cssBytes: css.bytes,
    cssCount: css.items.length,
    imageBytes: images.bytes,
    imageCandidateCount: imageCandidates.length,
    imageCount: imageResources.length,
    imageErrors: images.errors,
    imagePreloadCount: resources.imagePreloadCount,
    jsBytes: js.bytes,
    jsCount: js.items.length,
    jsFiles: js.items.map(({ bytes, url }) => ({ bytes, url })),
    status: htmlResponse.status,
    totalFetchedBytes:
      htmlResponse.bytes + css.bytes + js.bytes + (shouldFetchImages ? images.bytes : 0),
    variants,
  });
}

annotateSharedJavaScript(results);

printReport(results, { fetchedImages: shouldFetchImages });

if (budgetPath) {
  const budget = await readJsonFile(budgetPath);
  const violations = validateBudgets(results, budget);

  if (violations.length > 0) {
    printBudgetViolations(violations);
    process.exitCode = 1;
  } else {
    console.log("\nAsset budget check passed.");
  }
}

if (outputPath) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--fetch-images") {
      parsed.fetchImages = true;
      continue;
    }

    if (arg === "--base") {
      parsed.base = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--output") {
      parsed.output = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--budget") {
      parsed.budget = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--routes") {
      parsed.routes = argv[index + 1]
        .split(",")
        .map((route) => route.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return parsed;
}

async function resolveDefaultRoutes(baseUrl) {
  const routes = [...defaultRouteSeeds];
  const productHref = await findFirstHref(baseUrl, "/shop", "/shop/", {
    ignore: ["/shop/cart", "/shop/wishlist"],
  });

  if (productHref) {
    routes.splice(2, 0, productHref);
  }

  return routes;
}

async function findFirstHref(baseUrl, listPath, detailPrefix, options = {}) {
  const response = await fetchWithSize(new URL(listPath, baseUrl));
  const html = response.text ?? "";
  const ignored = new Set(options.ignore ?? []);
  const pattern = /href="([^"]+)"/g;

  for (const match of html.matchAll(pattern)) {
    const href = decodeHtml(match[1] ?? "");

    if (
      href.startsWith(detailPrefix) &&
      href !== detailPrefix.slice(0, -1) &&
      !ignored.has(href)
    ) {
      return href;
    }
  }

  return null;
}

async function readJsonFile(path) {
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(path, "utf8"));
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x2F;", "/");
}

function extractResources(html, pageUrl) {
  const links = extractTags(html, "link");
  const scripts = extractTags(html, "script");
  const images = extractTags(html, "img");
  const sources = extractTags(html, "source");
  const videos = extractTags(html, "video");
  const imagePreloadCount = links.filter(
    (attrs) => hasToken(attrs.rel, "preload") && attrs.as === "image",
  ).length;
  const highPriorityImageCount = images.filter(
    (attrs) => attrs.fetchpriority === "high",
  ).length;
  const eagerImageCount = images.filter(
    (attrs) => attrs.loading === "eager",
  ).length;
  const imageSrcUrls = uniqueUrls([
    ...images.map((attrs) => toAbsoluteUrl(attrs.src, pageUrl)),
    ...videos.map((attrs) => toAbsoluteUrl(attrs.poster, pageUrl)),
    ...links
      .filter((attrs) => attrs.as === "image")
      .map((attrs) => toAbsoluteUrl(attrs.href, pageUrl)),
  ]);
  const imageCandidateUrls = uniqueUrls([
    ...imageSrcUrls,
    ...images.flatMap((attrs) => extractSrcSetUrls(attrs.srcset, pageUrl)),
    ...sources.flatMap((attrs) => extractSrcSetUrls(attrs.srcset, pageUrl)),
  ]);

  return {
    css: uniqueUrls(
      links
        .filter((attrs) => hasToken(attrs.rel, "stylesheet"))
        .map((attrs) => toAbsoluteUrl(attrs.href, pageUrl)),
    ),
    eagerImageCount,
    highPriorityImageCount,
    imageCandidates: imageCandidateUrls,
    images: imageSrcUrls,
    imagePreloadCount,
    js: uniqueUrls(
      scripts
        .map((attrs) => toAbsoluteUrl(attrs.src, pageUrl))
        .filter(Boolean)
        .filter((url) => url.includes("/_next/static/")),
    ),
  };
}

function extractTags(html, tagName) {
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  const attrPattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  const tags = [];

  for (const tag of html.match(tagPattern) ?? []) {
    const attrs = {};

    for (const match of tag.matchAll(attrPattern)) {
      attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? "";
    }

    tags.push(attrs);
  }

  return tags;
}

function extractSrcSetUrls(srcset, pageUrl) {
  if (!srcset) {
    return [];
  }

  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .map((url) => toAbsoluteUrl(url, pageUrl))
    .filter(Boolean);
}

function hasToken(value, token) {
  return value?.split(/\s+/).includes(token);
}

function toAbsoluteUrl(value, pageUrl) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return null;
  }

  return new URL(value.replaceAll("&amp;", "&"), pageUrl).toString();
}

function uniqueUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

async function fetchResourceGroup(urls, options = {}) {
  const items = [];
  const errors = [];

  for (const url of urls) {
    try {
      items.push(await fetchWithSize(url));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!options.tolerateErrors) {
        throw error;
      }

      errors.push({ message, url });
    }
  }

  return {
    bytes: items.reduce((total, item) => total + item.bytes, 0),
    errors,
    items,
  };
}

async function fetchWithSize(url) {
  const response = await fetch(url, {
    headers: {
      "accept-encoding": "identity",
    },
    signal: AbortSignal.timeout(20000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    bytes: buffer.byteLength,
    contentType,
    status: response.status,
    text: contentType.includes("text/html") ? buffer.toString("utf8") : undefined,
    url: url.toString(),
  };
}

function summarizeImageVariants(urls) {
  const variants = {
    detail: 0,
    list: 0,
    master: 0,
    other: 0,
    thumbnail: 0,
  };

  for (const url of urls) {
    const sourceUrl = decodeImageSourceUrl(url);

    if (/\/detail\.webp(?:$|[?#])/.test(sourceUrl)) {
      variants.detail += 1;
    } else if (/\/list\.webp(?:$|[?#])/.test(sourceUrl)) {
      variants.list += 1;
    } else if (/\/master\.webp(?:$|[?#])/.test(sourceUrl)) {
      variants.master += 1;
    } else if (/\/thumbnail\.webp(?:$|[?#])/.test(sourceUrl)) {
      variants.thumbnail += 1;
    } else {
      variants.other += 1;
    }
  }

  return variants;
}

function decodeImageSourceUrl(url) {
  const parsed = new URL(url);
  const optimizedUrl = parsed.searchParams.get("url");

  if (!optimizedUrl) {
    return url;
  }

  try {
    return decodeURIComponent(optimizedUrl);
  } catch {
    return optimizedUrl;
  }
}

function printReport(data, { fetchedImages }) {
  const table = data.map((item) => ({
    route: item.route,
    status: item.status,
    html: formatBytes(item.htmlBytes),
    css: `${item.cssCount} / ${formatBytes(item.cssBytes)}`,
    js: `${item.jsCount} / ${formatBytes(item.jsBytes)}`,
    routeJs: formatBytes(item.routeJsBytes),
    sharedJs: formatBytes(item.sharedJsBytes),
    images: fetchedImages
      ? `${item.imageCount} / ${formatBytes(item.imageBytes)}`
      : `${item.imageCount} refs`,
    priority: `preload ${item.imagePreloadCount}, high ${item.highPriorityImageCount}, eager ${item.eagerImageCount}`,
    variants: `candidates ${item.imageCandidateCount}: list ${item.variants.list}, detail ${item.variants.detail}, thumb ${item.variants.thumbnail}, master ${item.variants.master}, other ${item.variants.other}`,
    total: formatBytes(item.totalFetchedBytes),
  }));

  console.table(table);

  const imageErrors = data.flatMap((item) =>
    item.imageErrors.map((error) => ({ route: item.route, ...error })),
  );

  if (imageErrors.length > 0) {
    console.log("\nImage fetch errors:");
    console.table(imageErrors);
  }
}

function annotateSharedJavaScript(results) {
  if (results.length === 0) {
    return;
  }

  const occurrences = new Map();
  const sizeByUrl = new Map();

  for (const result of results) {
    const urls = new Set(result.jsFiles.map((file) => file.url));

    for (const url of urls) {
      occurrences.set(url, (occurrences.get(url) ?? 0) + 1);
    }

    for (const file of result.jsFiles) {
      sizeByUrl.set(file.url, file.bytes);
    }
  }

  const sharedUrls = [...occurrences.entries()]
    .filter(([, count]) => count === results.length)
    .map(([url]) => url);
  const sharedJsBytes = sharedUrls.reduce(
    (total, url) => total + (sizeByUrl.get(url) ?? 0),
    0,
  );

  for (const result of results) {
    result.sharedJsBytes = sharedJsBytes;
    result.routeJsBytes = Math.max(0, result.jsBytes - sharedJsBytes);
  }
}

function validateBudgets(results, budget) {
  const violations = [];

  for (const item of results) {
    if (item.status < 200 || item.status >= 400) {
      violations.push({
        field: "status",
        max: "2xx/3xx",
        route: item.route,
        value: item.status,
      });
    }

    const patternBudget = getMatchingRouteBudget(item.route, budget);
    const routeBudget = {
      ...(budget.defaults ?? {}),
      ...patternBudget,
      ...(budget.routes?.[item.route] ?? {}),
    };

    for (const [field, max] of Object.entries(routeBudget)) {
      if (typeof max !== "number" || !(field in item)) {
        continue;
      }

      if (item[field] > max) {
        violations.push({
          field,
          max,
          route: item.route,
          value: item[field],
        });
      }
    }

    const variantBudget = {
      ...(budget.defaults?.variants ?? {}),
      ...(patternBudget.variants ?? {}),
      ...(budget.routes?.[item.route]?.variants ?? {}),
    };

    for (const [variant, max] of Object.entries(variantBudget)) {
      if (typeof max !== "number" || !(variant in item.variants)) {
        continue;
      }

      if (item.variants[variant] > max) {
        violations.push({
          field: `variants.${variant}`,
          max,
          route: item.route,
          value: item.variants[variant],
        });
      }
    }
  }

  return violations;
}

function getMatchingRouteBudget(route, budget) {
  const matched = {};

  for (const item of budget.routePatterns ?? []) {
    if (!item?.pattern || !item.budget) {
      continue;
    }

    if (new RegExp(item.pattern).test(route)) {
      Object.assign(matched, item.budget);
    }
  }

  return matched;
}

function printBudgetViolations(violations) {
  console.log("\nAsset budget violations:");
  console.table(
    violations.map((item) => ({
      route: item.route,
      field: item.field,
      value: formatBudgetValue(item.field, item.value),
      max: formatBudgetValue(item.field, item.max),
    })),
  );
}

function formatBudgetValue(field, value) {
  if (field === "status") {
    return String(value);
  }

  return field.toLowerCase().includes("bytes")
    ? formatBytes(value)
    : String(value);
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(2)} MB`;
}
