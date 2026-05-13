import Image from "next/image";
import type {
  ButtonHTMLAttributes,
  FocusEvent,
  KeyboardEvent,
} from "react";
import type { ShippingMethod } from "@/lib/orders/order-model";
import { CommerceQuantityStepper } from "@/components/site/commerce-form-primitives";
import { ShopChevronDownIcon } from "./shop-icons";

export {
  ShopGiftIcon as ProductGiftIcon,
  ShopHeartIcon as ProductHeartIcon,
} from "./shop-icons";

type ProductCommerceButtonVariant =
  | "buy"
  | "mobile-buy"
  | "mobile-gift"
  | "mobile-npay"
  | "mobile-wish"
  | "npay"
  | "secondary"
  | "wish";

type ProductCommerceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: ProductCommerceButtonVariant;
};

type ProductQuantityStepperProps = {
  decreaseLabel: string;
  increaseLabel: string;
  inputLabel: string;
  max: number;
  onChange: (value: number) => void;
  value: number;
};

type ProductShippingOption = {
  label: string;
  value: ShippingMethod;
};

type ProductShippingSelectProps = {
  isOpen: boolean;
  label: string;
  menuId: string;
  onBlur: (event: FocusEvent<HTMLDivElement>) => void;
  onSelect: (value: ShippingMethod) => void;
  onToggle: () => void;
  onTriggerKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  options: ProductShippingOption[];
  selectedLabel: string;
  selectedValue: ShippingMethod;
};

const buttonClassNameByVariant = {
  buy: "product-buy-button",
  "mobile-buy": "product-mobile-buy",
  "mobile-gift": "product-mobile-gift",
  "mobile-npay": "product-mobile-npay",
  "mobile-wish": "product-mobile-wish",
  npay: "product-npay-button",
  secondary: "product-secondary-button",
  wish: "product-wish-button",
} satisfies Record<ProductCommerceButtonVariant, string>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ProductCommerceButton({
  className,
  type = "button",
  variant,
  ...props
}: ProductCommerceButtonProps) {
  return (
    <button
      {...props}
      className={cx(buttonClassNameByVariant[variant], className)}
      type={type}
    />
  );
}

export function ProductQuantityStepper({
  decreaseLabel,
  increaseLabel,
  inputLabel,
  max,
  onChange,
  value,
}: ProductQuantityStepperProps) {
  return (
    <CommerceQuantityStepper
      ariaLabel={inputLabel}
      className="product-quantity-stepper"
      decreaseLabel={decreaseLabel}
      increaseLabel={increaseLabel}
      inputLabel={inputLabel}
      max={max}
      onChange={onChange}
      value={value}
    />
  );
}

export function ProductShippingSelect({
  isOpen,
  label,
  menuId,
  onBlur,
  onSelect,
  onToggle,
  onTriggerKeyDown,
  options,
  selectedLabel,
  selectedValue,
}: ProductShippingSelectProps) {
  return (
    <div
      className="product-shipping-select"
      data-open={isOpen ? "true" : "false"}
      onBlur={onBlur}
    >
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className="product-shipping-select-trigger"
        onClick={onToggle}
        onKeyDown={onTriggerKeyDown}
        type="button"
      >
        <span>{selectedLabel}</span>
        <span className="product-shipping-select-icon" aria-hidden="true">
          <ShopChevronDownIcon />
        </span>
      </button>
      {isOpen ? (
        <div className="product-shipping-options" id={menuId} role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === selectedValue}
              className="product-shipping-option"
              key={option.value}
              onClick={() => onSelect(option.value)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(option.value);
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                onSelect(option.value);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductNPayLogo() {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className="product-npay-logo"
      height={52}
      src="/asset/logo_npaybk_small.svg"
      width={168}
    />
  );
}
