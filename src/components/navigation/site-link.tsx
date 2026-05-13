import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { AppHref } from "@/lib/routing/types";

type SiteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children?: ReactNode;
  href: AppHref;
  prefetch?: boolean;
};

export type SiteLinkHref = AppHref;

export function SiteLink({ prefetch, ...props }: SiteLinkProps) {
  void prefetch;

  return <a {...props} />;
}
