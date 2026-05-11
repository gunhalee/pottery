import "server-only";

const islandAddressKeywords = [
  "가파도",
  "거문도",
  "백령",
  "비양도",
  "상추자",
  "소청",
  "신안",
  "연평",
  "완도",
  "울릉",
  "자은",
  "제주",
  "추자",
  "하추자",
  "흑산",
];

export function isRestrictedPlantShippingAddress(input: {
  address1?: string | null;
  address2?: string | null;
  postcode?: string | null;
}) {
  const postcode = input.postcode?.replace(/\D/g, "") ?? "";
  const address = `${input.address1 ?? ""} ${input.address2 ?? ""}`;

  if (postcode.startsWith("63")) {
    return true;
  }

  return islandAddressKeywords.some((keyword) => address.includes(keyword));
}
