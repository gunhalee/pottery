import type { JsonLdObject } from "@/lib/seo/json-ld";

export function JsonLd({
  data,
  id,
}: {
  data: JsonLdObject | JsonLdObject[];
  id?: string;
}) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
