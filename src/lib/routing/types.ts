import type { ComponentProps } from "react";
import type Link from "next/link";

export type AppHref = ComponentProps<typeof Link>["href"];
