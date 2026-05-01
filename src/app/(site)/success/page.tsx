import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function SuccessPage() {
  return (
    <PlaceholderPage
      eyebrow="Success"
      title="결제 성공 페이지 자리입니다."
      description="예약 완료 후 결제 승인 결과와 안내 메시지를 보여줄 예정입니다."
      checklist={["결제 결과 요약", "예약 안내", "후속 CTA"]}
    />
  );
}
