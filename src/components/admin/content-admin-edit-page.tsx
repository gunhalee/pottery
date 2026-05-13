import { deleteContentEntryAction } from "@/app/admin/actions";
import {
  AdminActionButton,
  AdminActionLink,
} from "@/components/admin/admin-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSuccessNotice } from "@/components/admin/admin-success-notice";
import { ContentEditorForm } from "@/components/admin/content-editor/content-editor-form";
import type { MediaPickerAsset } from "@/components/admin/media-picker";
import { getContentPublishErrorMessage } from "@/lib/admin/publish-errors";
import type {
  ContentEntry,
  ContentKind,
} from "@/lib/content-manager/content-model";
import {
  getContentAdminPath,
  getContentKindLabel,
  getContentPublicPath,
} from "@/lib/content-manager/content-store";

type ContentAdminEditPageProps = {
  created?: string;
  deleteError?: string;
  entry: ContentEntry;
  imageDeleted?: string;
  kind: ContentKind;
  mediaAssets?: MediaPickerAsset[];
  productOptions?: Array<{
    slug: string;
    title: string;
  }>;
  publishError?: string;
  saved?: string;
  slugError?: string;
};

export function ContentAdminEditPage({
  created,
  deleteError,
  entry,
  imageDeleted,
  kind,
  mediaAssets = [],
  productOptions,
  publishError,
  saved,
  slugError,
}: ContentAdminEditPageProps) {
  const label = getContentKindLabel(kind);
  const adminPath = getContentAdminPath(kind);
  const previewHref = `${adminPath}/${entry.id}/preview`;
  const publicHref =
    entry.status === "published"
      ? `${getContentPublicPath(kind)}/${entry.slug}`
      : null;

  return (
    <main className="admin-page admin-content-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>{entry.title}</h1>
          <p>
            {label} 콘텐츠의 본문, 이미지, 공개 상태를 편집합니다. 저장 전
            오른쪽 미리보기와 별도 preview 화면으로 표시 상태를 확인할 수
            있습니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <AdminActionLink href={adminPath}>목록</AdminActionLink>
          <AdminNav />
        </div>
      </header>

      {created ? (
        <AdminSuccessNotice
          description={`${label} 초안을 만들었습니다. 본문을 채운 뒤 published로 저장하면 공개 링크가 표시됩니다.`}
          key={`content-created-${entry.id}`}
          secondaryHref={previewHref}
          title="초안을 만들었습니다."
        />
      ) : null}
      {saved ? (
        <AdminSuccessNotice
          description={
            publicHref
              ? `저장된 ${label}이 공개되었습니다. 공개 페이지를 바로 확인할 수 있습니다.`
              : `${label}을 저장했습니다. 아직 draft 상태이므로 공개 링크 대신 미리보기를 확인할 수 있습니다.`
          }
          key={`content-saved-${entry.updatedAt}`}
          primaryHref={publicHref}
          primaryLabel={`게시된 ${label} 보기`}
          secondaryHref={previewHref}
          secondaryLabel="관리자 미리보기"
          title="저장했습니다."
        />
      ) : null}
      {imageDeleted ? (
        <div className="admin-alert">이미지를 삭제했습니다.</div>
      ) : null}
      {slugError ? (
        <div className="admin-alert admin-alert-danger">
          이미 사용 중인 slug입니다.
        </div>
      ) : null}
      {publishError ? (
        <div className="admin-alert admin-alert-danger">
          {getContentPublishErrorMessage(publishError)}
        </div>
      ) : null}
      {deleteError ? (
        <div className="admin-alert admin-alert-danger">
          삭제 확인 문구가 slug와 일치하지 않습니다.
        </div>
      ) : null}

      <ContentEditorForm
        entry={entry}
        mediaAssets={mediaAssets}
        previewHref={previewHref}
        productOptions={productOptions}
      />

      <section className="admin-panel admin-danger-zone admin-content-danger-zone">
        <h2>{label} 삭제</h2>
        <p>
          삭제하면 본문과 연결된 Supabase Storage 이미지가 함께 삭제됩니다.
          실행하려면 아래 입력칸에 <strong>{entry.slug}</strong>를 그대로
          입력해 주세요.
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
          <AdminActionButton type="submit" variant="danger">
            삭제
          </AdminActionButton>
        </form>
      </section>
    </main>
  );
}
