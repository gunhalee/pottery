import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { readMediaLibraryAssets } from "@/lib/media/media-store";

export const metadata = {
  title: "Media Library",
};

export default async function AdminMediaPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/media");
  }

  const assets = await readMediaLibraryAssets();

  return (
    <main className="admin-page admin-media-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>미디어</h1>
          <p>
            상품, 작품, 소식에서 함께 쓰는 공용 이미지 자산입니다. 이미지는
            하나의 asset으로 보관되고 각 화면의 역할은 usage로 관리됩니다.
          </p>
        </div>
        <AdminNav />
      </header>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>라이브러리</h2>
          <span>{assets.length} assets</span>
        </div>
        {assets.length > 0 ? (
          <div className="admin-media-library-grid">
            {assets.map((asset) => {
              const thumbnail =
                asset.variants.find((variant) => variant.variant === "thumbnail") ??
                asset.variants.find((variant) => variant.variant === "list") ??
                null;

              return (
                <article className="admin-media-library-item" key={asset.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={asset.alt} src={thumbnail?.src ?? asset.src} />
                  <div>
                    <strong>{asset.artworkTitle ?? asset.alt}</strong>
                    <span>{asset.usageCount} usages</span>
                    {asset.reserved ? <span>보관</span> : null}
                  </div>
                  <code>{asset.masterPath}</code>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="admin-empty-text">아직 등록된 미디어가 없습니다.</p>
        )}
      </section>
    </main>
  );
}
