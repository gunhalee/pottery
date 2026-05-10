"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type FloatingActionMessage = {
  id: number;
  text: string;
};

export function ScrollToTopButton() {
  const pathname = usePathname();
  const [message, setMessage] = useState<FloatingActionMessage | null>(null);
  const showShopActions = pathname === "/shop" || pathname.startsWith("/shop/");

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message]);

  function showPlaceholderMessage(text: string) {
    setMessage({
      id: Date.now(),
      text,
    });
  }

  return (
    <div className="floating-quick-actions" aria-label="빠른 이동">
      {showShopActions ? (
        <>
          <button
            aria-label="찜 보기"
            className="floating-action-button"
            onClick={() =>
              showPlaceholderMessage("찜 목록 기능은 준비 중입니다.")
            }
            type="button"
          >
            <HeartIcon />
          </button>
          <button
            aria-label="장바구니 보기"
            className="floating-action-button"
            onClick={() =>
              showPlaceholderMessage("장바구니 기능은 준비 중입니다.")
            }
            type="button"
          >
            <CartIcon />
          </button>
        </>
      ) : null}
      <a
        className="floating-action-button scroll-top-button"
        aria-label="맨 위로 이동"
        href="#site-top"
      >
        <span aria-hidden="true">↑</span>
      </a>
      {message ? (
        <p
          className="floating-action-message"
          aria-live="polite"
          key={message.id}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M20.4 5.6a5.2 5.2 0 0 0-7.4 0L12 6.7l-1-1.1a5.2 5.2 0 0 0-7.4 7.4l1 1 7.4 7.2 7.4-7.2 1-1a5.2 5.2 0 0 0 0-7.4Z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5.2 6.4h15l-1.4 7.2H7L5.8 3.8H3.5" />
      <circle cx="8.2" cy="19" r="1.4" />
      <circle cx="17.4" cy="19" r="1.4" />
    </svg>
  );
}
