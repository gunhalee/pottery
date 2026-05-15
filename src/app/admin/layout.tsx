import type { Metadata } from "next";
import type { ReactNode } from "react";
import { noIndexRobots } from "@/lib/seo/site";
import "./admin.css";

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
