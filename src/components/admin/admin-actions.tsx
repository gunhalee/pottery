import Link, { type LinkProps } from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ElementType,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

type AdminActionVariant =
  | "danger"
  | "danger-inline"
  | "primary"
  | "secondary"
  | "text";

type AdminActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminActionVariant;
};

type AdminActionLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  variant?: AdminActionVariant;
};

type AdminActionLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
    variant?: AdminActionVariant;
  };

type AdminExternalActionLinkProps =
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    variant?: AdminActionVariant;
  };

type AdminEmptyTextProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
};

const adminActionClassName = {
  danger: "admin-danger-button",
  "danger-inline": "admin-danger-inline-button",
  primary: "button-primary",
  secondary: "admin-secondary-button",
  text: "admin-text-button",
} satisfies Record<AdminActionVariant, string>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getAdminActionClassName(
  variant: AdminActionVariant = "secondary",
  className?: string,
) {
  return cx(adminActionClassName[variant], className);
}

export function AdminActionButton({
  className,
  type = "button",
  variant = "secondary",
  ...props
}: AdminActionButtonProps) {
  return (
    <button
      {...props}
      className={getAdminActionClassName(variant, className)}
      type={type}
    />
  );
}

export function AdminActionLabel({
  className,
  variant = "secondary",
  ...props
}: AdminActionLabelProps) {
  return (
    <label
      {...props}
      className={getAdminActionClassName(variant, className)}
    />
  );
}

export function AdminActionLink({
  className,
  prefetch = false,
  variant = "text",
  ...props
}: AdminActionLinkProps) {
  return (
    <Link
      {...props}
      className={getAdminActionClassName(variant, className)}
      prefetch={prefetch}
    />
  );
}

export function AdminExternalActionLink({
  className,
  rel,
  target,
  variant = "text",
  ...props
}: AdminExternalActionLinkProps) {
  return (
    <a
      {...props}
      className={getAdminActionClassName(variant, className)}
      rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
      target={target}
    />
  );
}

export function AdminEmptyText({
  as: Element = "p",
  className,
  ...props
}: AdminEmptyTextProps) {
  return <Element {...props} className={cx("admin-empty-text", className)} />;
}
