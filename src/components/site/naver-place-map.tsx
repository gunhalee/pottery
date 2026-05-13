"use client";

import Script from "next/script";
import { useRef, useState } from "react";

type NaverLatLngInstance = object;
type NaverMapInstance = object;
type NaverMarkerInstance = object;

type NaverInfoWindowInstance = {
  open: (map: NaverMapInstance, anchor?: NaverMarkerInstance) => void;
};

type NaverMapsNamespace = {
  Event: {
    addListener: (
      target: NaverMarkerInstance,
      eventName: string,
      listener: () => void,
    ) => void;
  };
  InfoWindow: new (options: {
    anchorSize?: { height: number; width: number };
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    content: string;
    pixelOffset?: { x: number; y: number };
  }) => NaverInfoWindowInstance;
  LatLng: new (latitude: number, longitude: number) => NaverLatLngInstance;
  Map: new (
    element: HTMLElement,
    options: {
      center: NaverLatLngInstance;
      logoControl?: boolean;
      mapDataControl?: boolean;
      minZoom?: number;
      scaleControl?: boolean;
      scrollWheel?: boolean;
      zoom: number;
      zoomControl?: boolean;
      zoomControlOptions?: { position: number };
    },
  ) => NaverMapInstance;
  Marker: new (options: {
    map: NaverMapInstance;
    position: NaverLatLngInstance;
    title?: string;
  }) => NaverMarkerInstance;
  Position: {
    TOP_RIGHT: number;
  };
};

declare global {
  interface Window {
    naver?: {
      maps?: NaverMapsNamespace;
    };
  }
}

type NaverPlaceMapProps = {
  address: string;
  className?: string;
  clientId?: string;
  latitude: number;
  longitude: number;
  name: string;
  placeUrl: string;
};

export function NaverPlaceMap({
  address,
  className,
  clientId,
  latitude,
  longitude,
  name,
  placeUrl,
}: NaverPlaceMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const keyId = clientId?.trim() ?? "";
  const showFallback = !keyId || hasLoadError;

  function initializeMap() {
    if (showFallback || initializedRef.current) {
      return;
    }

    const container = mapElementRef.current;
    const maps = window.naver?.maps;

    if (!container || !maps) {
      return;
    }

    try {
      initializedRef.current = true;

      const position = new maps.LatLng(latitude, longitude);
      const map = new maps.Map(container, {
        center: position,
        logoControl: true,
        mapDataControl: false,
        minZoom: 12,
        scaleControl: true,
        scrollWheel: false,
        zoom: 16,
        zoomControl: true,
        zoomControlOptions: {
          position: maps.Position.TOP_RIGHT,
        },
      });
      const marker = new maps.Marker({
        map,
        position,
        title: name,
      });
      const infoWindow = new maps.InfoWindow({
        anchorSize: { height: 10, width: 14 },
        backgroundColor: "#ffffff",
        borderColor: "#d7d7d2",
        borderWidth: 1,
        content: `<div class="naver-map-info"><strong>${escapeHtml(
          name,
        )}</strong><span>${escapeHtml(address)}</span></div>`,
        pixelOffset: { x: 0, y: -4 },
      });

      infoWindow.open(map, marker);
      maps.Event.addListener(marker, "click", () => {
        infoWindow.open(map, marker);
      });
      setIsReady(true);
    } catch {
      initializedRef.current = false;
      setHasLoadError(true);
    }
  }

  return (
    <div className={["naver-place-map", className].filter(Boolean).join(" ")}>
      {showFallback ? (
        <MapFallback address={address} name={name} placeUrl={placeUrl} />
      ) : (
        <>
          <Script
            id="naver-maps-openapi-v3"
            onError={() => setHasLoadError(true)}
            onReady={() => {
              window.requestAnimationFrame(initializeMap);
            }}
            src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
              keyId,
            )}`}
            strategy="afterInteractive"
          />
          <div
            aria-label={`${name} 위치 지도`}
            className="naver-place-map-canvas"
            ref={mapElementRef}
            role="img"
          />
          {!isReady ? (
            <div className="naver-place-map-status">지도를 불러오는 중입니다</div>
          ) : null}
        </>
      )}
    </div>
  );
}

function MapFallback({
  address,
  name,
  placeUrl,
}: {
  address: string;
  name: string;
  placeUrl: string;
}) {
  return (
    <div className="naver-place-map-fallback">
      <span>오시는 길</span>
      <strong>{name}</strong>
      <p>{address}</p>
      <a
        className="link-arrow"
        href={placeUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        네이버 지도에서 보기
      </a>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
