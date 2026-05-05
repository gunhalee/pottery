import Link from "next/link";
import { deleteContentEntryAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { ContentEditorForm } from "@/components/admin/content-editor/content-editor-form";
import type {
  ContentEntry,
  ContentKind,
} from "@/lib/content-manager/content-model";
import {
  getContentAdminPath,
  getContentKindLabel,
} from "@/lib/content-manager/content-store";

type ContentAdminEditPageProps = {
  created?: string;
  deleteError?: string;
  entry: ContentEntry;
  imageDeleted?: string;
  kind: ContentKind;
  productOptions?: Array<{
    slug: string;
    title: string;
  }>;
  saved?: string;
  slugError?: string;
};

export function ContentAdminEditPage({
  created,
  deleteError,
  entry,
  imageDeleted,
  kind,
  productOptions,
  saved,
  slugError,
}: ContentAdminEditPageProps) {
  const label = getContentKindLabel(kind);
  const adminPath = getContentAdminPath(kind);
  const previewHref = `${adminPath}/${entry.id}/preview`;

  return (
    <main className="admin-page admin-content-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>{entry.title}</h1>
          <p>
            {label} 콘텐츠의 본문, 이미지, 공개 상태를 편집합니다. 저장 전에는
            오른쪽 미리보기로 화면 계층을 확인할 수 있습니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-text-button" href={adminPath}>
            목록
          </Link>
          <AdminNav />
        </div>
      </header>

      {created ? <div className="admin-alert">초안을 만들었습니다.</div> : null}
      {saved ? <div className="admin-alert">저장했습니다.</div> : null}
      {imageDeleted ? (
        <div className="admin-alert">이미지를 삭제했습니다.</div>
      ) : null}
      {slugError ? (
        <div className="admin-alert admin-alert-danger">
          이미 사용 중인 slug입니다.
        </div>
      ) : null}
      {deleteError ? (
        <div className="admin-alert admin-alert-danger">
          삭제 확인 문구가 slug와 일치하지 않습니다.
        </div>
      ) : null}

      <ContentEditorForm
        entry={entry}
        previewHref={previewHref}
        productOptions={productOptions}
      />

      <section className="admin-panel admin-danger-zone admin-content-danger-zone">
        <h2>{label} 삭제</h2>
        <p>
          삭제하면 본문과 연결된 Supabase Storage 이미지가 함께 삭제됩니다.
          실행하려면 아래 입력칸에 <strong>{entry.slug}</strong>를 그대로 입력해
          주세요.
        </p>
        <form action={deleteContentEntryAction} className="admin-form">
          <input name="id" type="hidden" value={entry.id} />
          <input name="kind" type="hidden" value={kind} />
          <label>
            <span>삭제 확인</span>
            <input
              autoComplete="off"
              name="confirmSlug"
              placeholder={entry.slug}
              required
            />
          </label>
          <button className="admin-danger-button" type="submit">
            삭제
          </button>
        </form>
      </section>
    </main>
  );
}
