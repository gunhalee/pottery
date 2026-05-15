import type { Metadata } from "next";
import type { ReactNode } from "react";
import { noIndexRobots } from "@/lib/seo/site";
import "../gift.css";

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function GiftLayout({ children }: { children: ReactNode }) {
  return children;
}
