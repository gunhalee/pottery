import type { Metadata } from "next";
import type { ReactNode } from "react";
import { noIndexRobots } from "@/lib/seo/site";
import "../order.css";

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function OrderLayout({ children }: { children: ReactNode }) {
  return children;
}
