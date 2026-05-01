import { PageShell } from "@/components/site/primitives";

type NewsDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function NewsDetailPage({
  params,
}: NewsDetailPageProps) {
  const { slug } = await params;

  return (
    <PageShell className="detail-shell">
      <div className="placeholder-panel">
        <div className="small-caps">News Detail</div>
        <h1 className="section-title">게시글 상세 스캐폴드</h1>
        <p className="body-copy">
          현재 slug는 <span className="inline-code">{slug}</span>입니다. 추후
          추후 상세 본문과 SEO 메타데이터를 연결합니다.
        </p>
      </div>
    </PageShell>
  );
}
