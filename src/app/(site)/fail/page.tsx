import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function FailPage() {
  return (
    <PlaceholderPage
      eyebrow="Fail"
      title="결제 실패 페이지 자리입니다."
      description="실패 원인 안내와 재시도 경로를 제공할 예정입니다."
      checklist={["실패 사유 안내", "재시도 버튼", "문의 링크"]}
    />
  );
}
