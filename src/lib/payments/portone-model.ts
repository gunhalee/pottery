import type {
  DepositAccount,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/orders/order-model";

export type PortOnePayMethod =
  | "CARD"
  | "TRANSFER"
  | "VIRTUAL_ACCOUNT"
  | "MOBILE"
  | "GIFT_CERTIFICATE"
  | "EASY_PAY";

export type PortOneCashReceiptType = "PERSONAL" | "CORPORATE" | "ANONYMOUS";

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
  noticeUrls?: string[];
  orderName: string;
  payMethod: PortOnePayMethod;
  paymentId: string;
  redirectUrl: string;
  storeId: string;
  totalAmount: number;
  transfer?: {
    cashReceiptType?: PortOneCashReceiptType;
    customerIdentifier?: string;
  };
  virtualAccount?: {
    accountExpiry?: {
      dueDate?: string;
      validHours?: number;
    };
    cashReceiptType?: PortOneCashReceiptType;
    customerIdentifier?: string;
  };
};

export type PortOnePaymentPrepareResult = {
  orderId: string;
  orderNumber: string;
  paymentRequest: PortOnePaymentRequest;
  paymentStatus: PaymentStatus;
};

export type PortOnePaymentCompleteResult = {
  depositAccount?: DepositAccount;
  depositDueAt?: string | null;
  orderId: string;
  orderNumber: string;
  paymentMethod?: PaymentMethod;
  paymentId: string;
  paymentStatus: PaymentStatus;
  total: number;
};
