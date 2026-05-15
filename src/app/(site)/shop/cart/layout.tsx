import type { Metadata } from "next";
import type { ReactNode } from "react";
import { noIndexRobots } from "@/lib/seo/site";
import "../../cart.css";

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function CartLayout({ children }: { children: ReactNode }) {
  return children;
}
