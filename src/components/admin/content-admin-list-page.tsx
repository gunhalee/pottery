import Link from "next/link";
import { createContentDraftAction } from "@/app/admin/actions";
import {
  AdminActionButton,
  AdminActionLink,
} from "@/components/admin/admin-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import type {
  ContentEntry,
  ContentKind,
} from "@/lib/content-manager/content-model";
import {
  getContentAdminPath,
  getContentKindLabel,
  getContentPublicPath,
} from "@/lib/content-manager/content-store";

type ContentAdminListPageProps = {
  deleted?: string;
  entries: ContentEntry[];
  kind: ContentKind;
  missing?: string;
  slugError?: string;
};

export function ContentAdminListPage({
  deleted,
  entries,
  kind,
  missing,
  slugError,
}: ContentAdminListPageProps) {
  const label = getContentKindLabel(kind);
  const adminPath = getContentAdminPath(kind);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>{label} 관리</h1>
          <p>
            {label} 콘텐츠를 초안으로 작성하고, 본문/이미지/공개 상태를 저장합니다.
          </p>
        </div>
        <AdminNav />
      </header>

      {missing ? (
        <div className="admin-alert admin-alert-danger">
          콘텐츠를 찾을 수 없습니다.
        </div>
      ) : null}
      {deleted ? (
        <div className="admin-alert">콘텐츠를 삭제했습니다.</div>
      ) : null}
      {slugError ? (
        <div className="admin-alert admin-alert-danger">
          이미 사용 중인 slug입니다.
        </div>
      ) : null}

      <section className="admin-panel">
        <h2>새 {label} 초안</h2>
        <form action={createContentDraftAction} className="admin-inline-form">
          <input name="kind" type="hidden" value={kind} />
          <label>
            <span>제목</span>
            <input name="title" placeholder={`${label} 제목`} required />
          </label>
          <label>
            <span>slug</span>
            <input
              name="slug"
              pattern="[a-z0-9-]+"
              placeholder="비우면 자동 생성"
            />
          </label>
          <AdminActionButton type="submit" variant="primary">
            초안 만들기
          </AdminActionButton>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>{label} 목록</h2>
          <span>{entries.length} items</span>
        </div>
        <div className="admin-content-table">
          {entries.map((entry) => (
            <ContentEntryRow
              adminPath={adminPath}
              entry={entry}
              key={entry.id}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ContentEntryRow({
  adminPath,
  entry,
}: {
  adminPath: string;
  entry: ContentEntry;
}) {
  const publicPath = `${getContentPublicPath(entry.kind)}/${entry.slug}`;

  return (
    <article className="admin-content-row">
      <div>
        <Link href={`${adminPath}/${entry.id}`} prefetch={false}>
          <strong>{entry.title}</strong>
        </Link>
        <span>/{entry.slug}</span>
      </div>
      <div>{entry.displayDate || "날짜 없음"}</div>
      <div>{entry.status}</div>
      <div>{entry.images.length} images</div>
      <div>{formatDate(entry.updatedAt)}</div>
      {entry.status === "published" ? (
        <AdminActionLink href={publicPath}>
          보기
        </AdminActionLink>
      ) : (
        <span className="admin-muted-cell">비공개</span>
      )}
      <AdminActionLink href={`${adminPath}/${entry.id}`}>
        편집
      </AdminActionLink>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
