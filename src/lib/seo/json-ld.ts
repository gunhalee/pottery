import { siteConfig } from "@/lib/config/site";
import type { ContentEntry } from "@/lib/content-manager/content-model";
import { getContentCoverImage } from "@/lib/content-manager/content-images";
import type { ConsepotProduct } from "@/lib/shop";
import { getProductPrimaryImage } from "@/lib/shop";
import {
  getAbsoluteUrl,
  getBusinessAddress,
  getBusinessGeo,
  getBusinessTelephone,
  getSameAsUrls,
  normalizeDescription,
} from "./site";

export type JsonLdObject = Record<string, unknown>;

type BreadcrumbItem = {
  name: string;
  path: string;
};

const organizationId = getAbsoluteUrl("/#organization");
const localBusinessId = getAbsoluteUrl("/#local-business");

export function createOrganizationJsonLd(): JsonLdObject {
  return removeEmptyValues({
    "@context": "https://schema.org",
    "@id": organizationId,
    "@type": "Organization",
    legalName: siteConfig.businessName,
    name: siteConfig.name,
    sameAs: getSameAsUrls(),
    url: getAbsoluteUrl("/"),
  });
}

export function createLocalBusinessJsonLd(): JsonLdObject {
  return removeEmptyValues({
    "@context": "https://schema.org",
    "@id": localBusinessId,
    "@type": ["LocalBusiness", "Store"],
    address: getBusinessAddress(),
    areaServed: ["경기도 광주시", "능평동"],
    description: siteConfig.description,
    geo: {
      "@type": "GeoCoordinates",
      ...getBusinessGeo(),
    },
    legalName: siteConfig.businessName,
    name: siteConfig.name,
    sameAs: getSameAsUrls(),
    telephone: getBusinessTelephone(),
    url: getAbsoluteUrl("/"),
  });
}

export function createWebsiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@id": getAbsoluteUrl("/#website"),
    "@type": "WebSite",
    description: siteConfig.description,
    inLanguage: "ko-KR",
    name: siteConfig.name,
    publisher: {
      "@id": organizationId,
    },
    url: getAbsoluteUrl("/"),
  };
}

export function createBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: getAbsoluteUrl(item.path),
      name: item.name,
      position: index + 1,
    })),
  };
}

export function createProductJsonLd(product: ConsepotProduct): JsonLdObject {
  const image = getProductPrimaryImage(product);
  const imageUrl = image?.src ? getAbsoluteUrl(image.src) : undefined;
  const url = getAbsoluteUrl(`/shop/${product.slug}`);
  const description = normalizeDescription(
    product.storyText || product.story || product.shortDescription,
    500,
  );

  return removeEmptyValues({
    "@context": "https://schema.org",
    "@type": "Product",
    brand: {
      "@id": organizationId,
      "@type": "Brand",
      name: siteConfig.name,
    },
    description,
    image: imageUrl ? [imageUrl] : undefined,
    name: product.titleKo,
    offers:
      product.commerce.price === null
        ? undefined
        : {
            "@type": "Offer",
            availability: getSchemaAvailability(product.commerce.availabilityStatus),
            itemCondition: "https://schema.org/NewCondition",
            price: product.commerce.price,
            priceCurrency: product.commerce.currency,
            url,
          },
    url,
  });
}

export function createContentJsonLd(entry: ContentEntry): JsonLdObject {
  const isNews = entry.kind === "news";
  const path = `/${entry.kind}/${entry.slug}`;
  const image = getContentCoverImage(entry);
  const imageUrl = image?.src ? getAbsoluteUrl(image.src) : undefined;
  const description = normalizeDescription(entry.summary || entry.bodyText, 500);

  return removeEmptyValues({
    "@context": "https://schema.org",
    "@type": isNews ? "Article" : "CreativeWork",
    author: {
      "@id": organizationId,
    },
    creator: isNews
      ? undefined
      : {
          "@id": organizationId,
        },
    dateModified: entry.updatedAt,
    datePublished: entry.publishedAt ?? entry.createdAt,
    description,
    headline: isNews ? entry.title : undefined,
    image: imageUrl ? [imageUrl] : undefined,
    inLanguage: "ko-KR",
    mainEntityOfPage: getAbsoluteUrl(path),
    name: entry.title,
    publisher: {
      "@id": organizationId,
    },
    url: getAbsoluteUrl(path),
  });
}

function getSchemaAvailability(status: ConsepotProduct["commerce"]["availabilityStatus"]) {
  if (status === "available") {
    return "https://schema.org/InStock";
  }

  if (status === "sold_out") {
    return "https://schema.org/OutOfStock";
  }

  if (status === "upcoming") {
    return "https://schema.org/PreOrder";
  }

  return "https://schema.org/Discontinued";
}

function removeEmptyValues<T extends JsonLdObject>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === undefined || entryValue === null) {
        return false;
      }

      if (Array.isArray(entryValue) && entryValue.length === 0) {
        return false;
      }

      return true;
    }),
  ) as T;
}
