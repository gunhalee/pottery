import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { AppHref } from "@/lib/routing/types";

type SiteLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

export type SiteLinkHref = AppHref;

export function SiteLink({ prefetch = false, ...props }: SiteLinkProps) {
  return <Link {...props} prefetch={prefetch} />;
}
