export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "canceled"
  | "refunded";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "canceled"
  | "partial_refunded"
  | "refunded";

export type FulfillmentStatus =
  | "unfulfilled"
  | "pickup_ready"
  | "picked_up"
  | "preparing"
  | "shipped"
  | "delivered"
  | "returned"
  | "canceled";

export type ShippingMethod = "parcel" | "pickup";

export type CheckoutMode = "standard" | "gift" | "naver_pay";

export type OrderDraftInput = {
  checkoutMode: CheckoutMode;
  giftMessage?: string;
  lookupPassword: string;
  ordererEmail: string;
  ordererName: string;
  ordererPhone: string;
  productSlug: string;
  quantity: number;
  recipientName?: string;
  recipientPhone?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingMemo?: string;
  shippingMethod: ShippingMethod;
  shippingPostcode?: string;
};

export type OrderDraftResult = {
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  total: number;
};

export type OrderPaymentCompletionResult = {
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
};

export type OrderLookupInput = {
  orderNumber: string;
  password: string;
  phoneLast4: string;
};

export type OrderLookupItem = {
  lineTotal: number;
  name: string;
  quantity: number;
  status: string | null;
  unitPrice: number;
};

export type OrderLookupShipment = {
  carrier: string | null;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type OrderLookupResult = {
  createdAt: string;
  fulfillmentStatus: FulfillmentStatus;
  items: OrderLookupItem[];
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  recipientName: string | null;
  shipments: OrderLookupShipment[];
  shippingFee: number;
  shippingMethod: ShippingMethod;
  shippingSummary: string;
  subtotal: number;
  total: number;
};

export class OrderLookupVerificationError extends Error {
  constructor() {
    super("주문 정보를 확인하지 못했습니다.");
    this.name = "OrderLookupVerificationError";
  }
}
