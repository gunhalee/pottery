export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "canceled"
  | "deposit_expired"
  | "refund_pending"
  | "refunded";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "canceled"
  | "expired"
  | "refund_pending"
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

export type PaymentMethod = "portone" | "naver_pay" | "bank_transfer";

export type ProductOption = "plant_excluded" | "plant_included";

export type CashReceiptType = "none" | "personal" | "business";

export type CashReceiptIdentifierType =
  | "phone"
  | "cash_receipt_card"
  | "business_registration";

export type CashReceiptStatus =
  | "not_requested"
  | "requested"
  | "pending"
  | "issued"
  | "failed"
  | "canceled";

export type RefundAccountStatus =
  | "none"
  | "needs_review"
  | "confirmed"
  | "rejected"
  | "refunded";

export type BankTransferAccount = {
  accountHolder: string;
  accountNumber: string;
  bankName: string;
};

export type OrderDraftInput = {
  cashReceiptIdentifier?: string;
  cashReceiptIdentifierType?: CashReceiptIdentifierType;
  cashReceiptType?: CashReceiptType;
  checkoutMode: CheckoutMode;
  giftMessage?: string;
  lookupPassword: string;
  madeToOrder?: boolean;
  madeToOrderAcknowledged?: boolean;
  ordererEmail: string;
  ordererName: string;
  ordererPhone: string;
  paymentMethod?: PaymentMethod;
  productOption?: ProductOption;
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
  bankTransferAccount?: BankTransferAccount;
  depositDueAt?: string | null;
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
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
  productOption: ProductOption | null;
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
  bankTransferAccount?: BankTransferAccount;
  cashReceiptStatus: CashReceiptStatus;
  containsLivePlant: boolean;
  createdAt: string;
  depositConfirmedAt: string | null;
  depositDueAt: string | null;
  fulfillmentStatus: FulfillmentStatus;
  items: OrderLookupItem[];
  isMadeToOrder: boolean;
  madeToOrderDueMaxDays: number | null;
  madeToOrderDueMinDays: number | null;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  recipientName: string | null;
  refundAccountStatus: RefundAccountStatus;
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
