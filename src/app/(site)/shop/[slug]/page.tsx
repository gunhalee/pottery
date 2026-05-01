import { PageShell } from "@/components/site/primitives";

type ShopDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ShopDetailPage({
  params,
}: ShopDetailPageProps) {
  const { slug } = await params;

  return (
    <PageShell className="detail-shell">
      <div className="placeholder-panel">
        <div className="small-caps">Shop Detail</div>
        <h1 className="section-title">작품 상세 스캐폴드</h1>
        <p className="body-copy">
          현재 slug는 <span className="inline-code">{slug}</span>입니다. 추후
          작품 상세, 외부 구매, 프리미엄 문의 흐름을 연결합니다.
        </p>
      </div>
    </PageShell>
  );
}
