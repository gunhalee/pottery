import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type ClassSessionStatus = "archived" | "draft" | "published";

export type ClassSessionSummary = {
  createdAt: string;
  dateLabel: string | null;
  description: string | null;
  id: string;
  sessionDate: string | null;
  slug: string;
  status: ClassSessionStatus;
  title: string;
  updatedAt: string;
};

export type ClassSessionInput = {
  dateLabel?: string | null;
  description?: string | null;
  sessionDate?: string | null;
  slug?: string | null;
  status: ClassSessionStatus;
  title: string;
};

type ClassSessionRow = {
  created_at: string;
  date_label: string | null;
  description: string | null;
  id: string;
  session_date: string | null;
  slug: string;
  status: ClassSessionStatus;
  title: string;
  updated_at: string;
};

const classSessionColumns =
  "id, title, slug, status, session_date, date_label, description, created_at, updated_at";

export async function getPublishedClassSessions() {
  if (!isSupabaseConfigured()) {
    return [] satisfies ClassSessionSummary[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(classSessionColumns)
    .eq("status", "published")
    .order("session_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingClassSessionStorageError(error)) {
      return [] satisfies ClassSessionSummary[];
    }

    throw new Error(`Class sessions query failed: ${error.message}`);
  }

  return ((data ?? []) as ClassSessionRow[]).map(fromClassSessionRow);
}

export async function getAdminClassSessions() {
  if (!isSupabaseConfigured()) {
    return [] satisfies ClassSessionSummary[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(classSessionColumns)
    .order("session_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingClassSessionStorageError(error)) {
      return [] satisfies ClassSessionSummary[];
    }

    throw new Error(`Admin class sessions query failed: ${error.message}`);
  }

  return ((data ?? []) as ClassSessionRow[]).map(fromClassSessionRow);
}

export async function getClassSessionById(id: string) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(classSessionColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingClassSessionStorageError(error)) {
      return null;
    }

    throw new Error(`Class session query failed: ${error.message}`);
  }

  return data ? fromClassSessionRow(data as ClassSessionRow) : null;
}

export async function createClassSession(input: ClassSessionInput) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase class session storage is not configured.");
  }

  const title = input.title.trim();
  const slug = normalizeClassSessionSlug(input.slug || title);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .insert({
      date_label: emptyToNull(input.dateLabel),
      description: emptyToNull(input.description),
      session_date: emptyToNull(input.sessionDate),
      slug,
      status: input.status,
      title,
    })
    .select(classSessionColumns)
    .single();

  if (error) {
    throw new Error(`Class session insert failed: ${error.message}`);
  }

  return fromClassSessionRow(data as ClassSessionRow);
}

export async function updateClassSession({
  id,
  input,
}: {
  id: string;
  input: ClassSessionInput;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase class session storage is not configured.");
  }

  const title = input.title.trim();
  const slug = normalizeClassSessionSlug(input.slug || title);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .update({
      date_label: emptyToNull(input.dateLabel),
      description: emptyToNull(input.description),
      session_date: emptyToNull(input.sessionDate),
      slug,
      status: input.status,
      title,
    })
    .eq("id", id)
    .select(classSessionColumns)
    .single();

  if (error) {
    throw new Error(`Class session update failed: ${error.message}`);
  }

  return fromClassSessionRow(data as ClassSessionRow);
}

export function normalizeClassSessionSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `class-${Date.now()}`;
}

function fromClassSessionRow(row: ClassSessionRow): ClassSessionSummary {
  return {
    createdAt: row.created_at,
    dateLabel: row.date_label,
    description: row.description,
    id: row.id,
    sessionDate: row.session_date,
    slug: row.slug,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function emptyToNull(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isMissingClassSessionStorageError(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("class_sessions") &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("relation")))
  );
}
