"use server";

export async function submitCustomOrderInquiry() {
  return {
    ok: false,
    reason: "custom_order_out_of_scope",
  } as const;
}
