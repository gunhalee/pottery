import type { AnchorHTMLAttributes } from "react";

type FloatingActionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  prefetch?: boolean;
};
type FloatingActionAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FloatingActionLink({
  className,
  prefetch,
  ...props
}: FloatingActionLinkProps) {
  void prefetch;

  return <a {...props} className={cx("floating-action-button", className)} />;
}

export function FloatingActionAnchor({
  className,
  ...props
}: FloatingActionAnchorProps) {
  return <a {...props} className={cx("floating-action-button", className)} />;
}

export function FloatingArrowUpIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m6 11 6-6 6 6M12 5v14" />
    </svg>
  );
}
