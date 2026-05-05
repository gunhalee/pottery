import { redirect } from "next/navigation";
import { loginAdminAction } from "../actions";
import {
  isAdminAuthenticated,
  isAdminPasswordConfigured,
} from "@/lib/admin/auth";

type AdminLoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export const metadata = {
  title: "Admin Login",
};

export default async function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  const params = await searchParams;
  const authenticated = await isAdminAuthenticated();

  if (authenticated) {
    redirect(params.next ?? "/admin/products");
  }

  const configured = isAdminPasswordConfigured();

  return (
    <main className="admin-page admin-login-page">
      <section className="admin-login-panel">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>운영자 로그인</h1>
          <p>
            상품 등록과 Cafe24 동기화는 단일 운영자 세션에서만 실행합니다.
          </p>
        </div>

        {!configured ? (
          <div className="admin-alert">
            <strong>환경 변수가 필요합니다.</strong>
            <span>
              `ADMIN_PASSWORD` 또는 `ADMIN_PASSWORD_SHA256`을 설정하면 로그인이
              활성화됩니다.
            </span>
          </div>
        ) : null}

        {params.error ? (
          <div className="admin-alert admin-alert-danger">
            비밀번호를 다시 확인해 주세요.
          </div>
        ) : null}

        <form action={loginAdminAction} className="admin-form">
          <input
            name="next"
            type="hidden"
            value={params.next ?? "/admin/products"}
          />
          <label>
            <span>비밀번호</span>
            <input
              autoComplete="current-password"
              disabled={!configured}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="button-primary" disabled={!configured} type="submit">
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
