alter table public.cron_run_logs
  drop constraint if exists cron_run_logs_job_name_check;

alter table public.cron_run_logs
  add constraint cron_run_logs_job_name_check check (
    job_name in (
      'daily_maintenance',
      'upload_cleanup',
      'order_notifications',
      'virtual_account_expiry',
      'portone_payment_reconcile',
      'cafe24_inventory'
    )
  );
