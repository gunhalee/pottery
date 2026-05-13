"use client";

import { useEffect, useState } from "react";

const desktopColumnCount = 6;
const mobileColumnCount = 3;
const mobileFeedQuery = "(max-width: 640px)";

export function useGalleryFeedColumns() {
  const [columns, setColumns] = useState(desktopColumnCount);

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileFeedQuery);
    const updateColumns = () => {
      setColumns(mediaQuery.matches ? mobileColumnCount : desktopColumnCount);
    };

    updateColumns();
    mediaQuery.addEventListener("change", updateColumns);

    return () => {
      mediaQuery.removeEventListener("change", updateColumns);
    };
  }, []);

  return columns;
}
