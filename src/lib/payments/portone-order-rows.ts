import { z } from "zod";
import type {
  CashReceiptIdentifierType,
  CashReceiptType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/orders/order-model";

const orderStatusSchema = z.enum([
  "draft",
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "canceled",
  "deposit_expired",
  "refund_pending",
  "refunded",
]) satisfies z.ZodType<OrderStatus>;

const paymentStatusSchema = z.enum([
  "unpaid",
  "pending",
  "paid",
  "failed",
  "canceled",
  "expired",
  "refund_pending",
  "partial_refunded",
  "refunded",
]) satisfies z.ZodType<PaymentStatus>;

const paymentMethodSchema = z.enum([
  "portone_card",
  "portone_transfer",
  "portone_virtual_account",
  "naver_pay",
]) satisfies z.ZodType<PaymentMethod>;

const cashReceiptTypeSchema = z
  .enum(["personal", "business"])
  .nullable() satisfies z.ZodType<Exclude<CashReceiptType, "none"> | null>;

const cashReceiptIdentifierTypeSchema = z
  .enum(["phone", "cash_receipt_card", "business_registration"])
  .nullable() satisfies z.ZodType<CashReceiptIdentifierType | null>;

export const paymentOrderSelect = [
  "id",
  "order_number",
  "order_status",
  "payment_status",
  "payment_method",
  "orderer_name",
  "orderer_phone",
  "orderer_email",
  "total_krw",
  "portone_payment_id",
  "contains_live_plant",
  "is_gift",
  "is_made_to_order",
  "recipient_name",
  "recipient_phone",
  "shipping_address1",
  "deposit_due_at",
  "virtual_account_bank_name",
  "virtual_account_account_number",
  "virtual_account_account_holder",
  "cash_receipt_requested",
  "cash_receipt_type",
  "cash_receipt_identifier_type",
  "cash_receipt_identifier_encrypted",
  "cash_receipt_identifier_masked",
  "cash_receipt_status",
].join(", ");

const orderPaymentRowSchema = z.object({
  cash_receipt_identifier_encrypted: z.string().nullable(),
  cash_receipt_identifier_masked: z.string().nullable(),
  cash_receipt_identifier_type: cashReceiptIdentifierTypeSchema,
  cash_receipt_requested: z.boolean(),
  cash_receipt_status: z.string(),
  cash_receipt_type: cashReceiptTypeSchema,
  contains_live_plant: z.boolean(),
  deposit_due_at: z.string().nullable(),
  id: z.string(),
  is_gift: z.boolean(),
  is_made_to_order: z.boolean(),
  order_number: z.string(),
  order_status: orderStatusSchema,
  orderer_email: z.string(),
  orderer_name: z.string(),
  orderer_phone: z.string(),
  payment_method: paymentMethodSchema,
  payment_status: paymentStatusSchema,
  portone_payment_id: z.string().nullable(),
  recipient_name: z.string().nullable(),
  recipient_phone: z.string().nullable(),
  shipping_address1: z.string().nullable(),
  total_krw: z.number().int().nonnegative(),
  virtual_account_account_holder: z.string().nullable(),
  virtual_account_account_number: z.string().nullable(),
  virtual_account_bank_name: z.string().nullable(),
});

const orderPaymentItemRowSchema = z.object({
  product_title: z.string(),
  quantity: z.number().int().positive(),
  snapshot: z
    .object({
      checkoutMode: z.string().optional(),
    })
    .passthrough()
    .nullable(),
});

export type OrderPaymentRow = z.infer<typeof orderPaymentRowSchema>;
export type OrderPaymentItemRow = z.infer<typeof orderPaymentItemRowSchema>;

export function parseOrderPaymentRow(data: unknown): OrderPaymentRow {
  return orderPaymentRowSchema.parse(data);
}

export function parseOrderPaymentItems(data: unknown): OrderPaymentItemRow[] {
  return z.array(orderPaymentItemRowSchema).parse(data ?? []);
}
