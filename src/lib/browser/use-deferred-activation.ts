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

    let observer: IntersectionObserver | undefined;
    let cancelIdle: (() => void) | undefined;
    let activated = false;
    const activate = () => {
      if (activated) {
        return;
      }

      activated = true;
      observer?.disconnect();
      cancelIdle?.();
      setActive(true);
    };
    const element = ref.current;

    if (typeof idleTimeout === "number") {
      cancelIdle = scheduleWhenIdle(activate, idleTimeout);
    }

    if (!element || typeof IntersectionObserver === "undefined") {
      if (!cancelIdle) {
        cancelIdle = scheduleWhenIdle(activate, 0);
      }

      return () => {
        cancelIdle?.();
      };
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          activate();
        }
      },
      { rootMargin },
    );

    observer.observe(element);

    return () => {
      observer?.disconnect();
      cancelIdle?.();
    };
  }, [active, disabled, idleTimeout, rootMargin]);

  return { active, ref };
}
