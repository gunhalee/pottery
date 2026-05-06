export type AdminUploadContext = "content-image" | "product-image";

export type AdminUploadFeedback = {
  action?: string;
  description: string;
  detail?: string;
  title: string;
  tone: "error" | "info" | "success";
};

export type AdminUploadPayload = {
  code?: string;
  detail?: string;
  message?: string;
  nextAction?: string;
  ok?: boolean;
};

export class AdminUploadError extends Error {
  feedback: AdminUploadFeedback;

  constructor(feedback: AdminUploadFeedback) {
    super(feedback.description);
    this.name = "AdminUploadError";
    this.feedback = feedback;
  }
}

export async function readAdminUploadPayload<T>(
  response: Response,
): Promise<T | null> {
  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function buildAdminUploadError(
  response: Response,
  payload: AdminUploadPayload | null,
  context: AdminUploadContext,
) {
  const label = uploadContextLabel(context);
  const status = response.status;
  const title = `${label} 업로드 실패`;
  const fallbackDescription = getFallbackDescription(status, payload?.code, label);
  const description = cleanText(payload?.message) ?? fallbackDescription;
  const action =
    cleanText(payload?.nextAction) ??
    getFallbackAction(status, payload?.code, context);
  const detail =
    cleanText(payload?.detail) ??
    (!payload ? `HTTP ${status}: 서버 응답을 JSON으로 읽을 수 없습니다.` : undefined);

  return new AdminUploadError({
    action,
    description,
    detail,
    title,
    tone: "error",
  });
}

export function uploadExceptionToFeedback(
  error: unknown,
  context: AdminUploadContext,
) {
  if (error instanceof AdminUploadError) {
    return error.feedback;
  }

  const label = uploadContextLabel(context);

  if (error instanceof TypeError) {
    return {
      action: "인터넷 연결과 관리자 로그인 상태를 확인한 뒤 같은 파일로 다시 시도해 주세요.",
      description: "브라우저가 업로드 요청을 완료하지 못했습니다.",
      detail: error.message,
      title: `${label} 업로드 연결 실패`,
      tone: "error" as const,
    };
  }

  return {
    action: "같은 파일로 다시 시도하고, 반복되면 이미지를 다시 저장한 뒤 업로드해 주세요.",
    description: "이미지를 처리하는 중 예상하지 못한 문제가 발생했습니다.",
    detail: error instanceof Error ? error.message : undefined,
    title: `${label} 업로드 실패`,
    tone: "error" as const,
  };
}

export function formatAdminUploadFeedback(feedback: AdminUploadFeedback) {
  return [
    feedback.title,
    feedback.description,
    feedback.action ? `다음 단계: ${feedback.action}` : null,
    feedback.detail ? `세부 오류: ${feedback.detail}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function uploadContextLabel(context: AdminUploadContext) {
  return context === "product-image" ? "상품 이미지" : "본문 이미지";
}

function getFallbackDescription(
  status: number,
  code: string | undefined,
  label: string,
) {
  if (status === 401 || code === "AUTH_REQUIRED") {
    return "관리자 로그인이 만료되었거나 권한 확인에 실패했습니다.";
  }

  if (status === 413 || code === "FILE_TOO_LARGE") {
    return `${label} 파일이 업로드 제한보다 큽니다.`;
  }

  if (code === "UNSUPPORTED_FILE_TYPE") {
    return "지원하지 않는 이미지 형식입니다.";
  }

  if (status === 503 || code === "STORAGE_NOT_CONFIGURED") {
    return "이미지를 저장할 Supabase Storage 설정을 확인할 수 없습니다.";
  }

  if (status >= 500 || code === "UPLOAD_PROCESSING_FAILED") {
    return "이미지를 webp로 변환하거나 storage에 저장하는 중 문제가 발생했습니다.";
  }

  return "업로드 요청을 완료하지 못했습니다.";
}

function getFallbackAction(
  status: number,
  code: string | undefined,
  context: AdminUploadContext,
) {
  if (status === 401 || code === "AUTH_REQUIRED") {
    return "관리자 페이지에 다시 로그인한 뒤 업로드를 다시 진행해 주세요.";
  }

  if (status === 413 || code === "FILE_TOO_LARGE") {
    return "이미지를 8MB 이하로 줄인 뒤 다시 업로드해 주세요.";
  }

  if (code === "UNSUPPORTED_FILE_TYPE") {
    return "jpg, png, webp 파일로 저장한 뒤 다시 업로드해 주세요.";
  }

  if (status === 503 || code === "STORAGE_NOT_CONFIGURED") {
    return "Supabase Storage 환경변수와 media-assets 버킷 설정을 확인해 주세요.";
  }

  if (context === "content-image") {
    return "파일을 다시 선택해 업로드하고, 반복되면 다른 이름으로 저장한 이미지를 사용해 주세요.";
  }

  return "같은 파일로 다시 시도하고, 반복되면 다른 이름으로 저장한 이미지를 사용해 주세요.";
}

function cleanText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
