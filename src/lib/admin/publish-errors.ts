export type ContentPublishErrorCode =
  | "body-image"
  | "cover"
  | "list"
  | "slug"
  | "title"
  | "variant";

export type ProductPublishErrorCode =
  | "cover"
  | "list"
  | "price"
  | "slug"
  | "title"
  | "variant";

const contentPublishErrorMessages: Record<ContentPublishErrorCode, string> = {
  "body-image":
    "본문에서 참조하는 이미지가 이미지 목록에 없습니다. 본문 이미지를 다시 삽입해 주세요.",
  cover: "공개하려면 대표 이미지가 필요합니다.",
  list: "공개하려면 목록 이미지가 필요합니다.",
  slug: "공개하려면 slug가 필요합니다.",
  title: "공개하려면 제목이 필요합니다.",
  variant:
    "공개하려면 선택된 이미지의 detail/list variant가 모두 준비되어야 합니다. 미디어 화면에서 variant를 재생성해 주세요.",
};

const productPublishErrorMessages: Record<ProductPublishErrorCode, string> = {
  cover: "공개하려면 대표 이미지가 필요합니다.",
  list: "공개하려면 목록 이미지가 필요합니다.",
  price: "판매 중 상품에는 가격이 필요합니다.",
  slug: "공개하려면 slug가 필요합니다.",
  title: "공개하려면 상품명이 필요합니다.",
  variant:
    "공개하려면 선택한 이미지의 detail/list variant가 준비되어야 합니다. 미디어 화면에서 variant를 재생성해 주세요.",
};

export function getContentPublishErrorMessage(code: string) {
  return (
    contentPublishErrorMessages[code as ContentPublishErrorCode] ??
    "공개에 필요한 필수 정보가 부족합니다. 제목, slug, 대표 이미지, 목록 이미지, 이미지 variant를 확인해 주세요."
  );
}

export function getProductPublishErrorMessage(code: string) {
  return (
    productPublishErrorMessages[code as ProductPublishErrorCode] ??
    "공개에 필요한 필수 정보가 부족합니다. 상품명, slug, 대표 이미지, 목록 이미지, 이미지 variant를 확인해 주세요."
  );
}
