export const commerceConfig = {
  businessRegistrationNumber: "129-37-99678",
  payment: {
    virtualAccountDepositDueHours: 24,
  },
  policyEffectiveDate: "2026.05.12",
  plantShipping: {
    seasonalRestrictionEnabled:
      process.env.PLANT_SEASONAL_SHIPPING_RESTRICTED === "1",
  },
} as const;
