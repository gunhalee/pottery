export const commerceConfig = {
  bankTransfer: {
    accountHolder: "크룬프로젝트",
    accountNumber: "469-910247-27807",
    bankName: "하나은행",
    depositDueHours: 24,
  },
  businessRegistrationNumber: "129-37-99678",
  policyEffectiveDate: "2026.05.11",
  plantShipping: {
    seasonalRestrictionEnabled:
      process.env.PLANT_SEASONAL_SHIPPING_RESTRICTED === "1",
  },
} as const;
