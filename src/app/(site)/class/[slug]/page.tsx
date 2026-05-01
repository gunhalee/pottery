import { PageShell } from "@/components/site/primitives";

type ClassDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ClassDetailPage({
  params,
}: ClassDetailPageProps) {
  const { slug } = await params;

  return (
    <PageShell className="detail-shell">
      <div className="placeholder-panel">
        <div className="small-caps">Class Detail</div>
        <h1 className="section-title">클래스 상세 스캐폴드</h1>
        <p className="body-copy">
          현재 slug는 <span className="inline-code">{slug}</span>입니다. 추후
          Notion 클래스 소개, DB 세션 조회, 예약/결제 흐름을
          연결합니다.
        </p>
      </div>
    </PageShell>
  );
}
