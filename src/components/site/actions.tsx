import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentProps,
  ElementType,
  HTMLAttributes,
  ReactNode,
} from "react";
import { SiteLink } from "@/components/navigation/site-link";

type SiteActionVariant = "primary" | "quiet";
type SiteStatusTone = "error" | "neutral" | "success";

type SiteActionLinkProps = ComponentProps<typeof SiteLink> & {
  variant?: SiteActionVariant;
};

type SiteExternalActionLinkProps =
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: SiteActionVariant;
  };

type SiteActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SiteActionVariant;
};

type SiteArrowLinkProps = ComponentProps<typeof SiteLink>;
type SiteExternalArrowLinkProps = AnchorHTMLAttributes<HTMLAnchorElement>;
type SiteArrowTextProps = HTMLAttributes<HTMLSpanElement>;

type SiteEmptyStateProps = HTMLAttributes<HTMLElement> & {
  action?: ReactNode;
  as?: ElementType;
  children?: ReactNode;
  title?: ReactNode;
};

type SiteStatusMessageProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: SiteStatusTone;
};

const actionClassNameByVariant = {
  primary: "button-primary",
  quiet: "button-quiet",
} satisfies Record<SiteActionVariant, string>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getSiteActionClassName(
  variant: SiteActionVariant = "primary",
  className?: string,
) {
  return cx(actionClassNameByVariant[variant], className);
}

export function SiteActionLink({
  className,
  variant = "primary",
  ...props
}: SiteActionLinkProps) {
  return (
    <SiteLink {...props} className={getSiteActionClassName(variant, className)} />
  );
}

export function SiteExternalActionLink({
  className,
  rel = "noopener noreferrer",
  target = "_blank",
  variant = "primary",
  ...props
}: SiteExternalActionLinkProps) {
  return (
    <a
      {...props}
      className={getSiteActionClassName(variant, className)}
      rel={rel}
      target={target}
    />
  );
}

export function SiteActionButton({
  className,
  type = "button",
  variant = "primary",
  ...props
}: SiteActionButtonProps) {
  return (
    <button
      {...props}
      className={getSiteActionClassName(variant, className)}
      type={type}
    />
  );
}

export function SiteArrowLink({ className, ...props }: SiteArrowLinkProps) {
  return <SiteLink {...props} className={cx("link-arrow", className)} />;
}

export function SiteExternalArrowLink({
  className,
  rel = "noopener noreferrer",
  target = "_blank",
  ...props
}: SiteExternalArrowLinkProps) {
  return (
    <a
      {...props}
      className={cx("link-arrow", className)}
      rel={rel}
      target={target}
    />
  );
}

export function SiteArrowText({ className, ...props }: SiteArrowTextProps) {
  return <span {...props} className={cx("link-arrow", className)} />;
}

export function SiteEmptyState({
  action,
  as: Element = "div",
  children,
  className,
  title,
  ...props
}: SiteEmptyStateProps) {
  return (
    <Element {...props} className={cx("site-empty-state", className)}>
      {title ? <strong>{title}</strong> : null}
      {children}
      {action}
    </Element>
  );
}

export function SiteStatusMessage({
  children,
  className,
  role,
  tone = "neutral",
  ...props
}: SiteStatusMessageProps) {
  return (
    <p
      {...props}
      className={cx(
        "site-status-message",
        tone !== "neutral" && `site-status-message-${tone}`,
        className,
      )}
      role={role ?? (tone === "error" ? "alert" : "status")}
    >
      {children}
    </p>
  );
}
