"use client";

import { useDeferredActivation } from "@/lib/browser/use-deferred-activation";

export function useLazyFeedActivation(rootMargin = "640px") {
  return useDeferredActivation({ rootMargin });
}
