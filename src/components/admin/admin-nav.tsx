import Link from "next/link";
import { logoutAdminAction } from "@/app/admin/actions";

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
          구매평
        </Link>
        <Link href="/admin/news" prefetch={false}>
          소식
        </Link>
        <Link href="/admin/gallery" prefetch={false}>
          작업물
        </Link>
        <Link href="/admin/media" prefetch={false}>
          미디어
        </Link>
        <Link href="/admin/ops" prefetch={false}>
          운영
        </Link>
      </nav>
      <form action={logoutAdminAction}>
        <button className="admin-text-button" type="submit">
          로그아웃
        </button>
      </form>
    </div>
  );
}
