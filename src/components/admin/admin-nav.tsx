import Link from "next/link";
import { logoutAdminAction } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin/admin-actions";

export function AdminNav() {
  return (
    <div className="admin-header-actions">
      <nav className="admin-nav-links" aria-label="Admin sections">
        <Link href="/admin/products" prefetch={false}>
          상품
        </Link>
        <Link href="/admin/orders" prefetch={false}>
          주문
        </Link>
        <Link href="/admin/reviews" prefetch={false}>
          후기
        </Link>
        <Link href="/admin/class-sessions" prefetch={false}>
          클래스
        </Link>
        <Link href="/admin/news" prefetch={false}>
          소식
        </Link>
        <Link href="/admin/gallery" prefetch={false}>
          작품
        </Link>
        <Link href="/admin/media" prefetch={false}>
          미디어
        </Link>
        <Link href="/admin/ops" prefetch={false}>
          운영
        </Link>
      </nav>
      <form action={logoutAdminAction}>
        <AdminActionButton type="submit" variant="text">
          로그아웃
        </AdminActionButton>
      </form>
    </div>
  );
}
