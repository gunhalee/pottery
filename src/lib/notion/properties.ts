import "server-only";
import type { PageObjectResponse } from "@notionhq/client";

type NotionPropertyValue = PageObjectResponse["properties"][string];

function narrowPropertyType<TType extends NotionPropertyValue["type"]>(
  property: NotionPropertyValue | undefined,
  type: TType,
) {
  if (!property || property.type !== type) {
    return null;
  }

  return property as Extract<NotionPropertyValue, { type: TType }>;
}

function joinPlainText(items: { plain_text: string }[]) {
  return items.map((item) => item.plain_text).join("").trim();
}

function normalizeFileUrl(
  file:
    | Extract<
        Extract<NotionPropertyValue, { type: "files" }>["files"][number],
        { type: "file" | "external" | "file_upload" }
      >
    | undefined,
) {
  if (!file) {
    return null;
  }

  if (file.type === "file") {
    return file.file.url;
  }

  if (file.type === "external") {
    return file.external.url;
  }

  return null;
}

export function getTitleProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "title");
  return property ? joinPlainText(property.title) : "";
}

export function getRichTextProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "rich_text");
  return property ? joinPlainText(property.rich_text) : "";
}

export function getSelectProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "select");
  return property?.select?.name ?? null;
}

export function getMultiSelectProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "multi_select");
  return property?.multi_select.map((item) => item.name) ?? [];
}

export function getNumberProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "number");
  return property?.number ?? null;
}

export function getCheckboxProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "checkbox");
  return property?.checkbox ?? false;
}

export function getUrlProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "url");
  return property?.url ?? null;
}

export function getDateStartProperty(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "date");
  return property?.date?.start ?? null;
}

export function getFilesPropertyFirstUrl(
  properties: PageObjectResponse["properties"],
  propertyName: string,
) {
  const property = narrowPropertyType(properties[propertyName], "files");
  return normalizeFileUrl(property?.files[0]);
}
