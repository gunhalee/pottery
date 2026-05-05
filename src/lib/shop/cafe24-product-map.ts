import type { Cafe24ProductMapping } from "./product-model";

export const cafe24ProductMap = {
  "moon-white-bowl": {
    categoryNo: 29,
    displayGroup: 1,
    mappingStatus: "pending",
    productNo: null,
  },
  "ash-glaze-cup": {
    categoryNo: 29,
    displayGroup: 1,
    mappingStatus: "pending",
    productNo: null,
  },
  "kiln-limited-vase": {
    categoryNo: 29,
    displayGroup: 1,
    mappingStatus: "pending",
    productNo: null,
  },
} as const satisfies Record<string, Cafe24ProductMapping>;
