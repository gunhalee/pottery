import { SiteLink } from "@/components/navigation/site-link";
import {
  getCafe24CartAction,
  getCafe24DirectCheckoutHref,
  getCafe24ProductHref,
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
  const cafe24CartAction =
    cta.kind === "buy" ? getCafe24CartAction(product) : null;
  const cafe24CheckoutHref =
    cta.kind === "buy" && !cafe24CartAction
      ? getCafe24DirectCheckoutHref(product)
      : null;
  const cafe24ProductHref =
    cta.kind === "buy" && !cafe24CartAction && !cafe24CheckoutHref
      ? getCafe24ProductHref(product)
      : null;

  if (cta.kind === "buy" && cafe24CartAction) {
    return <Cafe24CartAction {...cafe24CartAction} className={className} />;
  }

  if (cta.kind === "buy" && cafe24CheckoutHref) {
    return (
      <a className={className} href={cafe24CheckoutHref}>
        {cta.label}
      </a>
    );
  }

  if (cta.kind === "buy" && cafe24ProductHref) {
    return (
      <a className={className} href={cafe24ProductHref}>
        {cta.label}
      </a>
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
    <SiteLink className={className} href={action.href}>
      {cta.label}
    </SiteLink>
  );
}
