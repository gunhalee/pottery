/* eslint-disable @next/next/no-img-element */

import type { JSX } from "react";
import {
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type {
  ContentImage,
  ContentImageLayout,
} from "@/lib/content-manager/content-model";

export type ContentImageNodePayload = Pick<
  ContentImage,
  "alt" | "caption" | "height" | "id" | "layout" | "src" | "width"
>;

type SerializedContentImageNode = Spread<
  ContentImageNodePayload,
  SerializedLexicalNode
>;

type SerializedYouTubeNode = Spread<
  {
    url: string;
    videoId: string;
  },
  SerializedLexicalNode
>;

type SerializedInstagramNode = Spread<
  {
    url: string;
  },
  SerializedLexicalNode
>;

export class ContentImageNode extends DecoratorNode<JSX.Element> {
  __alt: string;
  __caption?: string;
  __height: number;
  __id: string;
  __layout: ContentImageLayout;
  __src: string;
  __width: number;

  static getType() {
    return "content-image";
  }

  static clone(node: ContentImageNode) {
    return new ContentImageNode(
      {
        alt: node.__alt,
        caption: node.__caption,
        height: node.__height,
        id: node.__id,
        layout: node.__layout,
        src: node.__src,
        width: node.__width,
      },
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedContentImageNode) {
    return $createContentImageNode(serializedNode);
  }

  constructor(payload: ContentImageNodePayload, key?: NodeKey) {
    super(key);
    this.__alt = payload.alt;
    this.__caption = payload.caption;
    this.__height = payload.height;
    this.__id = payload.id;
    this.__layout = payload.layout;
    this.__src = payload.src;
    this.__width = payload.width;
  }

  exportJSON(): SerializedContentImageNode {
    return {
      alt: this.__alt,
      caption: this.__caption,
      height: this.__height,
      id: this.__id,
      layout: this.__layout,
      src: this.__src,
      type: "content-image",
      version: 1,
      width: this.__width,
    };
  }

  createDOM() {
    const element = document.createElement("div");
    element.className = "lexical-decorator lexical-decorator-image";
    return element;
  }

  updateDOM() {
    return false;
  }

  decorate() {
    return (
      <figure className={`editor-image-node editor-image-node-${this.__layout}`}>
        <img
          alt={this.__alt}
          height={this.__height}
          src={this.__src}
          width={this.__width}
        />
        {this.__caption ? <figcaption>{this.__caption}</figcaption> : null}
      </figure>
    );
  }

  isInline() {
    return false;
  }
}

export class YouTubeNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __videoId: string;

  static getType() {
    return "youtube";
  }

  static clone(node: YouTubeNode) {
    return new YouTubeNode(node.__url, node.__videoId, node.__key);
  }

  static importJSON(serializedNode: SerializedYouTubeNode) {
    return $createYouTubeNode(serializedNode.url, serializedNode.videoId);
  }

  constructor(url: string, videoId: string, key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__videoId = videoId;
  }

  exportJSON(): SerializedYouTubeNode {
    return {
      type: "youtube",
      url: this.__url,
      version: 1,
      videoId: this.__videoId,
    };
  }

  createDOM() {
    const element = document.createElement("div");
    element.className = "lexical-decorator lexical-decorator-embed";
    return element;
  }

  updateDOM() {
    return false;
  }

  decorate() {
    return (
      <div className="editor-embed-node editor-youtube-node">
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          src={`https://www.youtube-nocookie.com/embed/${this.__videoId}`}
          title="YouTube video"
        />
      </div>
    );
  }

  isInline() {
    return false;
  }
}

export class InstagramNode extends DecoratorNode<JSX.Element> {
  __url: string;

  static getType() {
    return "instagram";
  }

  static clone(node: InstagramNode) {
    return new InstagramNode(node.__url, node.__key);
  }

  static importJSON(serializedNode: SerializedInstagramNode) {
    return $createInstagramNode(serializedNode.url);
  }

  constructor(url: string, key?: NodeKey) {
    super(key);
    this.__url = url;
  }

  exportJSON(): SerializedInstagramNode {
    return {
      type: "instagram",
      url: this.__url,
      version: 1,
    };
  }

  createDOM() {
    const element = document.createElement("div");
    element.className = "lexical-decorator lexical-decorator-embed";
    return element;
  }

  updateDOM() {
    return false;
  }

  decorate() {
    return (
      <div className="editor-embed-node editor-instagram-node">
        <span>Instagram</span>
        <a href={this.__url} rel="noopener noreferrer" target="_blank">
          {this.__url}
        </a>
      </div>
    );
  }

  isInline() {
    return false;
  }
}

export function $createContentImageNode(payload: ContentImageNodePayload) {
  return new ContentImageNode(payload);
}

export function $isContentImageNode(
  node: LexicalNode | null | undefined,
): node is ContentImageNode {
  return node instanceof ContentImageNode;
}

export function $createYouTubeNode(url: string, videoId: string) {
  return new YouTubeNode(url, videoId);
}

export function $createInstagramNode(url: string) {
  return new InstagramNode(url);
}

export function extractYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);

    if (url.hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const [, kind, id] = url.pathname.split("/");

      if (kind === "embed" || kind === "shorts") {
        return id ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeInstagramUrl(value: string) {
  try {
    const url = new URL(value);

    if (!url.hostname.endsWith("instagram.com")) {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}
