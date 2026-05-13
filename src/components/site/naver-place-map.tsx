import Image from "next/image";

const staticMapEndpoint =
  "https://maps.apigw.ntruss.com/map-static/v2/raster-cors";

type NaverPlaceMapProps = {
  address: string;
  apiKeyId?: string;
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
  apiKeyId,
  className,
  height = 520,
  latitude,
  longitude,
  name,
  placeUrl,
  width = 900,
}: NaverPlaceMapProps) {
  const keyId = apiKeyId?.trim();
  const mapImageUrl = keyId
    ? createStaticMapUrl({
        height,
        keyId,
        latitude,
        longitude,
        width,
      })
    : "";

  return (
    <figure className={["naver-place-map", className].filter(Boolean).join(" ")}>
      <a
        className="naver-place-map-link"
        href={placeUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {mapImageUrl ? (
          <Image
            alt={`${name} 위치 지도. 주소: ${address}`}
            className="naver-place-map-image"
            height={height}
            src={mapImageUrl}
            unoptimized
            width={width}
          />
        ) : (
          <div className="naver-place-map-empty">
            네이버 Static Map API Key ID 설정이 필요합니다
          </div>
        )}
      </a>
      <figcaption className="naver-place-map-caption">
        <strong>{name}</strong>
        <span>{address}</span>
      </figcaption>
    </figure>
  );
}

function createStaticMapUrl({
  height,
  keyId,
  latitude,
  longitude,
  width,
}: {
  height: number;
  keyId: string;
  latitude: number;
  longitude: number;
  width: number;
}) {
  const url = new URL(staticMapEndpoint);

  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(height));
  url.searchParams.set("center", `${longitude},${latitude}`);
  url.searchParams.set("level", "16");
  url.searchParams.set("format", "png");
  url.searchParams.set("scale", "2");
  url.searchParams.set(
    "markers",
    `type:d|size:mid|color:Default|pos:${longitude} ${latitude}`,
  );
  url.searchParams.set("X-NCP-APIGW-API-KEY-ID", keyId);

  return url.toString();
}
