import {
  assert,
  assertIncludes,
  getAdminCookieHeader,
  loadLocalEnv,
  startNextServer,
} from "./smoke-lib.mjs";

const port = Number(process.env.ADMIN_MEDIA_SMOKE_PORT ?? 3013);
const env = loadLocalEnv();
const app = startNextServer(port, { ...env, ...process.env });

try {
  await app.wait();
  await verifyAdminMediaFlow(app.baseUrl, getAdminCookieHeader(env));
  console.log(`Admin media smoke passed for ${app.baseUrl}`);
} finally {
  app.stop();
}

async function verifyAdminMediaFlow(baseUrl, cookie) {
  const unauthenticated = await fetch(`${baseUrl}/admin/media`, {
    redirect: "manual",
  });
  const loginLocation = unauthenticated.headers.get("location") ?? "";

  assert(
    unauthenticated.status === 307 && loginLocation.startsWith("/admin/login"),
    `/admin/media should redirect to login, got ${unauthenticated.status} ${loginLocation}`,
  );

  const media = await fetchAdmin(baseUrl, "/admin/media", cookie);
  const mediaHtml = await media.text();

  assert(media.status === 200, `/admin/media should return 200, got ${media.status}`);
  assertIncludes(mediaHtml, "admin-media-page", "admin media shell");
  assertIncludes(mediaHtml, "fallback usage", "fallback usage stat");
  assertIncludes(mediaHtml, "fallback detail", "fallback detail stat");
  assertIncludes(mediaHtml, "fallback list", "fallback list stat");
  assertIncludes(mediaHtml, "broken usage", "broken usage stat");
  assertIncludes(mediaHtml, "missing owner", "missing owner stat");
  assertIncludes(mediaHtml, "shared path", "shared storage path stat");
  assertIncludes(mediaHtml, "admin-media-integrity-list", "usage integrity panel");
  assertIncludes(mediaHtml, "admin-media-variant-grid", "variant grid");

  if (mediaHtml.includes("admin-regenerate-form")) {
    assertIncludes(mediaHtml, 'name="assetId"', "regenerate asset id input");
    assertIncludes(mediaHtml, 'name="returnTo"', "regenerate return input");
    assertIncludes(mediaHtml, "variant", "regenerate submit label");
  }

  const regenerated = await fetchAdmin(baseUrl, "/admin/media?regenerated=1", cookie);
  const regeneratedHtml = await regenerated.text();

  assert(
    regenerated.status === 200,
    `/admin/media?regenerated=1 should return 200, got ${regenerated.status}`,
  );
  assertIncludes(regeneratedHtml, "admin-alert", "regenerated alert");

  const regenerateError = await fetchAdmin(
    baseUrl,
    "/admin/media?regenerate_error=SmokeTest",
    cookie,
  );
  const regenerateErrorHtml = await regenerateError.text();

  assert(
    regenerateError.status === 200,
    `/admin/media?regenerate_error should return 200, got ${regenerateError.status}`,
  );
  assertIncludes(regenerateErrorHtml, "SmokeTest", "regenerate error text");

  const ops = await fetchAdmin(baseUrl, "/admin/ops", cookie);
  const opsHtml = await ops.text();

  assert(ops.status === 200, `/admin/ops should return 200, got ${ops.status}`);
  assertIncludes(opsHtml, "fallback usage", "ops media fallback summary");
  assertIncludes(opsHtml, "broken usage", "ops broken usage summary");
  assertIncludes(opsHtml, "shared storage path", "ops shared path summary");
}

function fetchAdmin(baseUrl, path, cookie) {
  return fetch(`${baseUrl}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
}
