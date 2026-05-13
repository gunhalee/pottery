type ShopHeartIconProps = {
  filled?: boolean;
};

export function ShopHeartIcon({ filled = false }: ShopHeartIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
    >
      <path d="M20.4 5.6a5.2 5.2 0 0 0-7.4 0L12 6.7l-1-1.1a5.2 5.2 0 0 0-7.4 7.4l1 1 7.4 7.2 7.4-7.2 1-1a5.2 5.2 0 0 0 0-7.4Z" />
    </svg>
  );
}

export function ShopGiftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7H8.8a2.2 2.2 0 1 1 2.2-2.2L12 7ZM12 7h3.2A2.2 2.2 0 1 0 13 4.8L12 7Z" />
    </svg>
  );
}

export function ShopCartIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5.2 6.4h15l-1.4 7.2H7L5.8 3.8H3.5" />
      <circle cx="8.2" cy="19" r="1.4" />
      <circle cx="17.4" cy="19" r="1.4" />
    </svg>
  );
}

export function ShopShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
    </svg>
  );
}

export function ShopChevronLeftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

export function ShopChevronRightIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ShopChevronDownIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ShopArrowLeftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
