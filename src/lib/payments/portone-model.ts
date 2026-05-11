import type { PaymentStatus } from "@/lib/orders/order-model";

export type PortOnePayMethod =
  | "CARD"
  | "TRANSFER"
  | "VIRTUAL_ACCOUNT"
  | "MOBILE"
  | "GIFT_CERTIFICATE"
  | "EASY_PAY";

export type PortOnePaymentRequest = {
  channelKey: string;
  currency: "CURRENCY_KRW";
  customer: {
    email: string;
    fullName: string;
    phoneNumber: string;
  };
  customData: {
    orderId: string;
    orderNumber: string;
  };
  orderName: string;
  payMethod: PortOnePayMethod;
  paymentId: string;
  redirectUrl: string;
  storeId: string;
  totalAmount: number;
};

export type PortOnePaymentPrepareResult = {
  paymentRequest: PortOnePaymentRequest;
};

export type PortOnePaymentCompleteResult = {
  orderNumber: string;
  paymentStatus: PaymentStatus;
  total: number;
};
