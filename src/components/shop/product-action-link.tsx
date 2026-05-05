import Link from "next/link";
import {
  getProductActionHref,
  getProductCta,
  type ConsepotProduct,
} from "@/lib/shop";

export function ProductActionLink({
  className = "button-primary",
  product,
}: {
  className?: string;
  product: ConsepotProduct;
}) {
  const cta = getProductCta(product);
  const action = getProductActionHref(product);

  if (!action.href) {
    return (
      <span aria-disabled="true" className={`${className} is-disabled`}>
        {cta.label}
      </span>
    );
  }

  if (action.external) {
    return (
      <a
        className={className}
        href={action.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {cta.label}
      </a>
    );
  }

  return (
    <Link className={className} href={action.href} prefetch={false}>
      {cta.label}
    </Link>
  );
}

