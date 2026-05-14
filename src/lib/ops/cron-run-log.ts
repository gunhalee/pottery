import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type CronJobName =
  | "daily_maintenance"
  | "naver_blog_sync"
  | "order_notifications"
  | "portone_payment_reconcile"
  | "upload_cleanup"
  | "virtual_account_expiry";
export type CronRunLogJobName = CronJobName;
export type CronRunStatus = "failed" | "running" | "success";

export type CronRunLog = {
  durationMs: number | null;
  errorMessage: string | null;
  finishedAt: string | null;
  id: string;
  jobName: CronRunLogJobName;
  startedAt: string;
  status: CronRunStatus;
  summary: Record<string, unknown>;
  triggerSource: string;
};

type CronRunRow = {
  duration_ms: number | null;
  error_message: string | null;
  finished_at: string | null;
  id: string;
  job_name: CronRunLogJobName;
  started_at: string;
  status: CronRunStatus;
  summary: Record<string, unknown> | null;
  trigger_source: string;
};

type CronRunHandle = {
  id: string;
  jobName: CronJobName;
  startedAt: string;
};

type StartCronRunInput = {
  jobName: CronJobName;
  summary?: Record<string, unknown>;
  triggerSource?: string;
};

export async function startCronRun({
  jobName,
  summary,
  triggerSource = "http",
}: StartCronRunInput): Promise<CronRunHandle> {
  const supabase = getSupabaseAdminClient();
  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("cron_run_logs")
    .insert({
      job_name: jobName,
      started_at: startedAt,
      status: "running",
      summary: normalizeSummary(summary),
      trigger_source: triggerSource,
    })
    .select("id, started_at")
    .single();

  if (error) {
    throw new Error(`Failed to start cron run log: ${error.message}`);
  }

  return {
    id: data.id,
    jobName,
    startedAt: data.started_at,
  };
}

export async function finishCronRun(
  handle: CronRunHandle,
  summary?: Record<string, unknown>,
) {
  await updateCronRun(handle, {
    errorMessage: null,
    status: "success",
    summary,
  });
}

export async function failCronRun(
  handle: CronRunHandle,
  error: unknown,
  summary?: Record<string, unknown>,
) {
  await updateCronRun(handle, {
    errorMessage: getErrorMessage(error),
    status: "failed",
    summary,
  });
}

export async function readCronRunLogs(limit = 30): Promise<CronRunLog[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cron_run_logs")
    .select(
      "id, job_name, status, trigger_source, started_at, finished_at, duration_ms, summary, error_message",
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to read cron run logs: ${error.message}`);
  }

  return ((data ?? []) as CronRunRow[]).map(mapCronRunRow);
}

async function updateCronRun(
  handle: CronRunHandle,
  {
    errorMessage,
    status,
    summary,
  }: {
    errorMessage: string | null;
    status: Exclude<CronRunStatus, "running">;
    summary?: Record<string, unknown>;
  },
) {
  const finishedAt = new Date();
  const durationMs = Math.max(
    0,
    finishedAt.getTime() - new Date(handle.startedAt).getTime(),
  );
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("cron_run_logs")
    .update({
      duration_ms: durationMs,
      error_message: errorMessage,
      finished_at: finishedAt.toISOString(),
      status,
      summary: normalizeSummary(summary),
    })
    .eq("id", handle.id);

  if (error) {
    console.error(`Failed to finish cron run log: ${error.message}`);
  }
}

function mapCronRunRow(row: CronRunRow): CronRunLog {
  return {
    durationMs: row.duration_ms,
    errorMessage: row.error_message,
    finishedAt: row.finished_at,
    id: row.id,
    jobName: row.job_name,
    startedAt: row.started_at,
    status: row.status,
    summary: row.summary ?? {},
    triggerSource: row.trigger_source,
  };
}

function normalizeSummary(summary?: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(summary ?? {})) as Record<string, unknown>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unknown cron execution error.";
}
