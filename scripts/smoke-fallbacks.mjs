import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src"];
const extensions = new Set([".css", ".ts", ".tsx"]);
const disallowedTerms = [
  "media-fallbacks",
  "fallbackArtworkImage",
  "createFallbackContentSlug",
  "content-entries.json",
  "data/shop-products.json",
  "getFallbackArtworkAlt",
  "getFallbackGalleryImages",
  "product-card-fallback-image",
  "fallbackImageSize",
];

const violations = [];

for (const root of roots) {
  for await (const filePath of walk(root)) {
    if (!extensions.has(path.extname(filePath))) {
      continue;
    }

    const source = await readFile(filePath, "utf8");

    for (const term of disallowedTerms) {
      if (source.includes(term)) {
        violations.push({ filePath, term });
      }
    }
  }
}

if (violations.length > 0) {
  console.table(violations);
  throw new Error("Disallowed fallback image terms found.");
}

console.log("Fallback naming smoke passed.");

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(entryPath);
    } else {
      yield entryPath;
    }
  }
}
