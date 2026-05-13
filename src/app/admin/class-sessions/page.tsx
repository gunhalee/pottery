import { redirect } from "next/navigation";
import { AdminEmptyText } from "@/components/admin/admin-actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getAdminClassSessions,
  type ClassSessionSummary,
} from "@/lib/shop/class-sessions";
import {
  createClassSessionAction,
  updateClassSessionAction,
} from "./actions";

type AdminClassSessionsPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export const metadata = {
  title: "Class Sessions Admin",
};

export default async function AdminClassSessionsPage({
  searchParams,
}: AdminClassSessionsPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/class-sessions");
  }

  const [sessions, flags] = await Promise.all([
    getAdminClassSessions(),
    searchParams,
  ]);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>클래스 회차</h1>
          <p>
            클래스 후기가 선택적으로 연결될 수 있는 회차를 관리합니다. 연결이
            없는 후기는 그대로 접수되며 경고로 보지 않습니다.
          </p>
        </div>
        <AdminNav />
      </header>

      {flags.saved ? (
        <div className="admin-alert">클래스 회차를 저장했습니다.</div>
      ) : null}
      {flags.error ? (
        <div className="admin-alert admin-alert-danger">
          클래스 회차를 저장하지 못했습니다. 제목과 slug 중복 여부를 확인해
          주세요.
        </div>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>새 회차</h2>
          <span>optional review link</span>
        </div>
        <ClassSessionForm action={createClassSessionAction} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>회차 목록</h2>
          <span>{sessions.length} sessions</span>
        </div>
        {sessions.length > 0 ? (
          <div className="admin-review-list">
            {sessions.map((session) => (
              <article className="admin-review-card" key={session.id}>
                <div className="admin-review-card-main">
                  <div>
                    <span className="admin-order-action">
                      {classSessionStatusLabel(session.status)}
                    </span>
                    <h2>{session.title}</h2>
                    <p>
                      {session.dateLabel || session.sessionDate || "날짜 미정"} ·{" "}
                      {session.slug}
                    </p>
                    {session.description ? <p>{session.description}</p> : null}
                  </div>
                </div>
                <ClassSessionForm
                  action={updateClassSessionAction}
                  session={session}
                />
              </article>
            ))}
          </div>
        ) : (
          <AdminEmptyText>아직 등록된 클래스 회차가 없습니다.</AdminEmptyText>
        )}
      </section>
    </main>
  );
}

function ClassSessionForm({
  action,
  session,
}: {
  action: (formData: FormData) => Promise<void>;
  session?: ClassSessionSummary;
}) {
  return (
    <form action={action} className="admin-form admin-class-session-form">
      {session ? <input name="id" type="hidden" value={session.id} /> : null}
      <label>
        <span>제목</span>
        <input
          defaultValue={session?.title ?? ""}
          maxLength={80}
          name="title"
          required
        />
      </label>
      <label>
        <span>slug</span>
        <input
          defaultValue={session?.slug ?? ""}
          maxLength={120}
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="wheel-basic-2026-05"
        />
      </label>
      <label>
        <span>상태</span>
        <select defaultValue={session?.status ?? "published"} name="status">
          <option value="published">공개</option>
          <option value="draft">draft</option>
          <option value="archived">보관</option>
        </select>
      </label>
      <label>
        <span>날짜</span>
        <input
          defaultValue={session?.sessionDate ?? ""}
          name="sessionDate"
          type="date"
        />
      </label>
      <label>
        <span>표시 날짜</span>
        <input
          defaultValue={session?.dateLabel ?? ""}
          maxLength={80}
          name="dateLabel"
          placeholder="2026년 봄 물레 클래스"
        />
      </label>
      <label className="admin-field-wide">
        <span>설명</span>
        <textarea
          defaultValue={session?.description ?? ""}
          maxLength={1200}
          name="description"
        />
      </label>
      <div className="admin-form-actions">
        <button className="admin-primary-button" type="submit">
          {session ? "회차 저장" : "회차 만들기"}
        </button>
      </div>
    </form>
  );
}

function classSessionStatusLabel(status: ClassSessionSummary["status"]) {
  return {
    archived: "보관",
    draft: "draft",
    published: "공개",
  }[status];
}
