import Image from "next/image";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

type NaverPlaceMapProps = {
  address: string;
  className?: string;
  height?: number;
  latitude: number;
  longitude: number;
  name: string;
  placeUrl: string;
  width?: number;
};

export function NaverPlaceMap({
  address,
  className,
  height = 520,
  latitude,
  longitude,
  name,
  placeUrl,
  width = 900,
}: NaverPlaceMapProps) {
  const mapImageUrl = new URLSearchParams({
    h: String(height),
    lat: String(latitude),
    lng: String(longitude),
    w: String(width),
  });

  return (
    <figure className={["naver-place-map", className].filter(Boolean).join(" ")}>
      <a
        className="naver-place-map-link"
        href={placeUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Image
          alt={`${name} 위치 지도. 주소: ${address}`}
          className="naver-place-map-image"
          height={height}
          sizes={mediaImageSizes.naverMapPreview}
          src={`/api/studio-map?${mapImageUrl.toString()}`}
          unoptimized
          width={width}
        />
      </a>
      <figcaption className="naver-place-map-caption">
        <strong>{name}</strong>
        <span>{address}</span>
      </figcaption>
    </figure>
  );
}
