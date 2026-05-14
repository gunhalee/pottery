alter table public.shop_notification_jobs
  drop constraint if exists shop_notification_jobs_template_check;

alter table public.shop_notification_jobs
  add constraint shop_notification_jobs_template_check check (
    template in (
      'admin_class_review_consent_received',
      'admin_class_review_received',
      'admin_feedback_received',
      'admin_fulfillment_shipped',
      'admin_gift_address_submitted',
      'admin_order_received',
      'admin_payment_paid',
      'admin_return_request_received',
      'admin_return_request_received_kakao',
      'deposit_expired',
      'deposit_guide',
      'deposit_reminder',
      'fulfillment_delivered',
      'fulfillment_preparing',
      'fulfillment_shipped',
      'gift_address_request',
      'gift_address_submitted',
      'made_to_order_confirmed',
      'made_to_order_delay',
      'order_canceled',
      'order_received',
      'payment_attention',
      'payment_paid',
      'picked_up',
      'pickup_ready',
      'return_request_confirmation',
      'return_request_confirmation_kakao'
    )
  );
