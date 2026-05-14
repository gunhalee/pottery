delete from public.cron_run_logs
where job_name in ('cafe24_inventory', 'bank_transfer_expiry');

alter table public.cron_run_logs
  drop constraint if exists cron_run_logs_job_name_check;

alter table public.cron_run_logs
  add constraint cron_run_logs_job_name_check check (
    job_name in (
      'daily_maintenance',
      'order_notifications',
      'portone_payment_reconcile',
      'upload_cleanup',
      'virtual_account_expiry'
    )
  );
