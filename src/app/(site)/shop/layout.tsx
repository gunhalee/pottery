import type { ReactNode } from "react";
import { ShopFloatingActions } from "@/components/shop/shop-floating-actions";
import "../commerce.css";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ShopFloatingActions />
    </>
  );
}
