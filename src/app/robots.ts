import type { MetadataRoute } from "next";
import { getAbsoluteUrl, getSiteUrl } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    host: getSiteUrl().origin,
    rules: {
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/checkout",
        "/checkout/",
        "/gift/",
        "/order/lookup",
        "/shop/cart",
        "/shop/wishlist",
      ],
      userAgent: "*",
    },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
  };
}
