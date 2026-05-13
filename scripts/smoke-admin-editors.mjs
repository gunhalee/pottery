import {
  assert,
  assertIncludes,
  getAdminCookieHeader,
  loadLocalEnv,
  startNextServer,
} from "./smoke-lib.mjs";

const port = Number(process.env.ADMIN_EDITORS_SMOKE_PORT ?? 3014);
const env = loadLocalEnv();
const app = startNextServer(port, { ...env, ...process.env });

try {
  await app.wait();
  await verifyEditorFlows(app.baseUrl, getAdminCookieHeader(env));
  console.log(`Admin editor smoke passed for ${app.baseUrl}`);
} finally {
  app.stop();
}

async function verifyEditorFlows(baseUrl, cookie) {
  const productListHtml = await expectAdminPage(
    baseUrl,
    "/admin/products",
    cookie,
    "admin product list",
  );
  const productHref = findFirstHref(productListHtml, "/admin/products/");

  if (productHref) {
    const productHtml = await expectAdminPage(
      baseUrl,
      productHref,
      cookie,
      "admin product editor",
    );

    assertIncludes(productHtml, "admin-edit-grid", "product editor layout");
    assertIncludes(productHtml, "product-edit-form", "product edit form");
    assertIncludes(productHtml, "admin-publish-readiness", "product publish readiness");
    assertIncludes(productHtml, "button-primary", "product primary submit button");

    if (productHtml.includes("admin-product-image-list")) {
      assertIncludes(productHtml, "admin-image-role-summary", "product image role summary");
      assertIncludes(productHtml, "admin-media-status-strip", "product image variant status");
    }
  }

  await verifyContentEditor(baseUrl, cookie, "gallery");
  await verifyContentEditor(baseUrl, cookie, "news");
}

async function verifyContentEditor(baseUrl, cookie, kind) {
  const listHtml = await expectAdminPage(
    baseUrl,
    `/admin/${kind}`,
    cookie,
    `admin ${kind} list`,
  );
  const entryHref = findFirstHref(listHtml, `/admin/${kind}/`);

  if (!entryHref) {
    return;
  }

  const editHtml = await expectAdminPage(
    baseUrl,
    entryHref,
    cookie,
    `admin ${kind} editor`,
  );

  assertIncludes(editHtml, "admin-content-editor", `${kind} editor shell`);
  assertIncludes(editHtml, "admin-content-preview-panel", `${kind} preview panel`);
  assertIncludes(editHtml, "admin-publish-readiness", `${kind} publish readiness`);
  assertIncludes(editHtml, "admin-save-button", `${kind} save button`);

  if (editHtml.includes("admin-image-item")) {
    assertIncludes(editHtml, "admin-image-role-summary", `${kind} image role summary`);
    assertIncludes(editHtml, "admin-media-status-strip", `${kind} image variant status`);
  }

  const preview = await fetchAdmin(baseUrl, `${entryHref}/preview`, cookie);
  assert(
    preview.status === 200,
    `${kind} preview should return 200, got ${preview.status}`,
  );
  assertIncludes(await preview.text(), "admin-preview-banner", `${kind} preview banner`);
}

async function expectAdminPage(baseUrl, path, cookie, label) {
  const response = await fetchAdmin(baseUrl, path, cookie);
  const html = await response.text();

  assert(response.status === 200, `${label} should return 200, got ${response.status}`);

  return html;
}

function fetchAdmin(baseUrl, path, cookie) {
  return fetch(`${baseUrl}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
}

function findFirstHref(html, prefix) {
  const pattern = /href="([^"]+)"/g;

  for (const match of html.matchAll(pattern)) {
    const href = decodeHtml(match[1] ?? "");

    if (
      href.startsWith(prefix) &&
      !href.includes("?") &&
      !href.endsWith("/preview")
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
