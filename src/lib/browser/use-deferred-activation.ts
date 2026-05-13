"use client";

import { useEffect, useRef, useState } from "react";
import { scheduleWhenIdle } from "./schedule-when-idle";

type UseDeferredActivationOptions = {
  disabled?: boolean;
  idleTimeout?: number;
  rootMargin?: string;
};

export function useDeferredActivation<TElement extends HTMLElement = HTMLElement>(
  {
    disabled = false,
    idleTimeout,
    rootMargin = "640px",
  }: UseDeferredActivationOptions = {},
) {
  const ref = useRef<TElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (disabled || active) {
      return;
    }

    const element = ref.current;

    if (!element || typeof IntersectionObserver === "undefined") {
      return scheduleWhenIdle(() => setActive(true), idleTimeout ?? 0);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [active, disabled, idleTimeout, rootMargin]);

  return { active, ref };
}
