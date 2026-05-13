import type { ReviewFormStatus } from "@/components/site/review-form-primitives";

type SubmitReviewFormOptions = {
  endpoint: string;
  fallbackErrorMessage?: string;
  fallbackSuccessMessage?: string;
  form: HTMLFormElement;
  prepareFormData?: (formData: FormData) => void;
};

type ReviewFormResponse = {
  error?: string;
  message?: string;
};

export async function submitReviewForm({
  endpoint,
  fallbackErrorMessage = "접수 중 오류가 발생했습니다.",
  fallbackSuccessMessage = "접수되었습니다. 검토 후 반영됩니다.",
  form,
  prepareFormData,
}: SubmitReviewFormOptions): Promise<NonNullable<ReviewFormStatus>> {
  const formData = new FormData(form);
  prepareFormData?.(formData);

  try {
    const response = await fetch(endpoint, {
      body: formData,
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as ReviewFormResponse;

    if (!response.ok) {
      return {
        kind: "error",
        message: result.error ?? fallbackErrorMessage,
      };
    }

    form.reset();

    return {
      kind: "success",
      message: result.message ?? fallbackSuccessMessage,
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error ? error.message : fallbackErrorMessage,
    };
  }
}
