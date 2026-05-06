"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void;
      };
    };
  }
}

export function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    if (window.instgrm?.Embeds) {
      window.instgrm.Embeds.process();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.instagram.com/embed.js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", () =>
        window.instgrm?.Embeds?.process(),
      );
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    script.onload = () => window.instgrm?.Embeds?.process();
    document.body.appendChild(script);
  }, []);

  return (
    <blockquote
      className="rich-text-embed rich-text-instagram instagram-media"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
    >
      <a href={url} rel="noopener noreferrer" target="_blank">
        Instagram에서 보기
      </a>
    </blockquote>
  );
}
