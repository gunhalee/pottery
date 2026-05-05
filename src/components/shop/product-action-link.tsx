import Link from "next/link";
import {
  getCafe24CartAction,
  getProductActionHref,
  getProductCta,
  type ConsepotProduct,
} from "@/lib/shop";
import { Cafe24CartAction } from "./cafe24-cart-action";

export function ProductActionLink({
  className = "button-primary",
  product,
}: {
  className?: string;
  product: ConsepotProduct;
}) {
  const cta = getProductCta(product);
  const action = getProductActionHref(product);
  const cafe24CartAction = cta.kind === "buy" ? getCafe24CartAction(product) : null;

  if (cta.kind === "buy" && cafe24CartAction) {
    return (
      <Cafe24CartAction
        {...cafe24CartAction}
        className={className}
        label={cta.label}
      />
    );
  }

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
