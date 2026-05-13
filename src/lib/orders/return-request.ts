import "server-only";

import type { MediaAsset } from "@/lib/media/media-model";
import {
  enqueueAdminKakaoNotificationJob,
  enqueueAdminNotificationJob,
  enqueueOrderNotificationJobs,
} from "@/lib/notifications/order-notifications";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { OrderLookupInput, ReturnRequestType } from "./order-model";
import {
  OrderLookupVerificationError,
} from "./order-model";
import { verifyOrderLookupPassword } from "./order-store";

export type ReturnRequestInput = OrderLookupInput & {
  customerContact: string;
  customerName: string;
  detail: string;
  reason: string;
  requestType: ReturnRequestType;
};

type ReturnRequestOrderRow = {
  id: string;
  lookup_password_hash: string;
  order_number: string;
  orderer_email: string | null;
  orderer_name: string | null;
  orderer_phone: string | null;
};

type ReturnRequestRow = {
  id: string;
};

export class ReturnRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ReturnRequestError";
  }
}

export async function createReturnRequest(input: ReturnRequestInput) {
  if (!isSupabaseConfigured()) {
    throw new ReturnRequestError("교환·반품 접수 저장소가 설정되지 않았습니다.", 503);
  }

  const order = await readVerifiedReturnRequestOrder(input);
  const supabase = getSupabaseAdminClient();
  const customerName = input.customerName.trim();
  const customerContact = input.customerContact.trim();
  const reason = input.reason.trim();
  const detail = input.detail.trim();

  if (!customerName || !customerContact || !reason || !detail) {
    throw new ReturnRequestError("교환·반품 접수 정보를 확인해 주세요.");
  }

  const { data, error } = await supabase
    .from("shop_return_requests")
    .insert({
      customer_contact: customerContact,
      customer_name: customerName,
      detail,
      order_id: order.id,
      reason,
      request_type: input.requestType,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new ReturnRequestError(
      `교환·반품 접수 저장 실패: ${error?.message ?? "응답 없음"}`,
      500,
    );
  }

  const request = data as ReturnRequestRow;

  await supabase.from("shop_order_events").insert({
    actor: "customer",
    event_type: "return_request_submitted",
    order_id: order.id,
    payload: {
      reason,
      requestId: request.id,
      requestType: input.requestType,
    },
  });

  await enqueueOrderNotificationJobs({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      reason,
      requestType: returnRequestTypeLabel(input.requestType),
    },
    recipient: {
      email: order.orderer_email,
    },
    template: "return_request_confirmation",
  });
  await enqueueOrderNotificationJobs({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      reason,
      requestType: returnRequestTypeLabel(input.requestType),
    },
    recipient: {
      phone: order.orderer_phone,
    },
    template: "return_request_confirmation_kakao",
  });
  await enqueueAdminNotificationJob({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      customerContact,
      reason,
      requestType: returnRequestTypeLabel(input.requestType),
    },
    template: "admin_return_request_received",
  });
  await enqueueAdminKakaoNotificationJob({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      customerContact,
      reason,
      requestType: returnRequestTypeLabel(input.requestType),
    },
    template: "admin_return_request_received_kakao",
  });

  return {
    id: request.id,
    orderNumber: order.order_number,
  };
}

export async function attachReturnRequestImages({
  assets,
  returnRequestId,
}: {
  assets: MediaAsset[];
  returnRequestId: string;
}) {
  if (!isSupabaseConfigured() || assets.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("shop_return_request_images").insert(
    assets.map((asset, index) => ({
      media_asset_id: asset.id,
      return_request_id: returnRequestId,
      sort_order: index,
    })),
  );

  if (error) {
    throw new ReturnRequestError(
      `교환·반품 사진 저장 실패: ${error.message}`,
      500,
    );
  }
}

async function readVerifiedReturnRequestOrder(
  input: OrderLookupInput,
): Promise<ReturnRequestOrderRow> {
  const orderNumber = input.orderNumber.trim().toUpperCase();
  const phoneLast4 = input.phoneLast4.replace(/\D/g, "").slice(-4);

  if (!orderNumber || !/^[0-9]{4}$/.test(phoneLast4)) {
    throw new OrderLookupVerificationError();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      [
        "id",
        "order_number",
        "orderer_name",
        "orderer_email",
        "orderer_phone",
        "lookup_password_hash",
      ].join(", "),
    )
    .eq("order_number", orderNumber)
    .eq("orderer_phone_last4", phoneLast4)
    .maybeSingle();

  if (error || !data) {
    throw new OrderLookupVerificationError();
  }

  const order = data as unknown as ReturnRequestOrderRow;

  if (!verifyOrderLookupPassword(input.password, order.lookup_password_hash)) {
    throw new OrderLookupVerificationError();
  }

  return order;
}

function returnRequestTypeLabel(type: ReturnRequestType) {
  return {
    damage: "파손·하자 문의",
    exchange: "교환 문의",
    other: "기타 문의",
    refund: "환불 문의",
    return: "반품 문의",
  }[type];
}
