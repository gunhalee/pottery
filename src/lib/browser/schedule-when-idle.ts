type BrowserWindowWithIdleCallback = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number },
  ) => number;
};

export function scheduleWhenIdle(callback: () => void, timeout: number) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const browserWindow = window as BrowserWindowWithIdleCallback;

  if (typeof browserWindow.requestIdleCallback === "function") {
    const handle = browserWindow.requestIdleCallback(callback, { timeout });

    return () => browserWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, timeout);

  return () => window.clearTimeout(handle);
}
