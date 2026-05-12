import Link from "next/link";

type NoticeProps = {
  className?: string;
};

export function ShippingNotice({ className }: NoticeProps) {
  return (
    <section className={joinClassNames("policy-notice", className)}>
      <h2>배송 안내</h2>
      <p>
        기본 배송비는 3,000원이며 할인 전 상품금액 50,000원 이상 구매 시
        무료배송됩니다.
      </p>
      <p>
        도서산간 지역은 주문 전 개별 안내 후 추가 배송비가 발생할 수 있고,
        결제 또는 입금 확인 후 2~5영업일 이내 발송을 원칙으로 합니다.
      </p>
      <Link href="/shipping-returns" prefetch={false}>
        배송·교환·환불 안내
      </Link>
    </section>
  );
}

export function ReturnNotice({ className }: NoticeProps) {
  return (
    <section className={joinClassNames("policy-notice", className)}>
      <h2>교환·반품 안내</h2>
      <p>
        상품 수령 후 7일 이내 교환·반품을 요청할 수 있습니다. 단순 변심으로
        인한 전체 반품 시 왕복 배송비 6,000원이 환불금에서 차감됩니다.
      </p>
      <p>
        무료배송 주문을 부분 반품하여 최종 구매금액이 무료배송 기준 미만이
        되는 경우 최초 배송비 3,000원이 차감될 수 있습니다.
      </p>
    </section>
  );
}

export function HandmadeCeramicNotice({ className }: NoticeProps) {
  return (
    <section className={joinClassNames("policy-notice", className)}>
      <h2>도자기 유의사항</h2>
      <p>
        수작업 도자기 특성상 유약 흐름, 철점, 작은 기포, 색감 차이, 형태
        차이, 굽 자국, 표면 질감 차이가 있을 수 있습니다.
      </p>
      <p>상품별 안내 범위 내의 수작업 특성은 하자로 보기 어려울 수 있습니다.</p>
    </section>
  );
}

export function UsageNotice({ className }: NoticeProps) {
  return (
    <section className={joinClassNames("policy-notice", className)}>
      <h2>사용 및 관리 안내</h2>
      <p>
        전자레인지, 식기세척기, 오븐, 직화 사용 가능 여부는 상품별 상세 안내를
        따릅니다. 장식용으로 안내된 상품은 식기로 사용하지 마세요.
      </p>
    </section>
  );
}

export function LivePlantNotice({
  className,
  returnNotice,
}: NoticeProps & {
  returnNotice?: string;
}) {
  return (
    <section className={joinClassNames("policy-notice policy-notice-accent", className)}>
      <h2>생화·식물 포함 상품 안내</h2>
      <p>
        식물은 생물 특성상 계절, 생육 상태, 배송 환경, 수령 지연, 관리 상태에
        따라 상태가 달라질 수 있습니다.
      </p>
      <p>
        수령 후 가능한 빠르게 개봉하고 상품별 안내에 따라 통풍, 물주기, 햇빛
        조건을 확인해 주세요.
      </p>
      <p>
        생화·식물 포함 상품은 수령 지연·개봉 후 관리 부주의·생육 변화에 따른
        교환·반품이 제한될 수 있습니다.
      </p>
      {returnNotice ? <p>{returnNotice}</p> : null}
    </section>
  );
}

export function PickupNotice({ className }: NoticeProps) {
  return (
    <section className={joinClassNames("policy-notice", className)}>
      <h2>방문수령 안내</h2>
      <p>
        방문수령 장소는 경기도 광주시 수레실길 25-10 1층이며, 수령 일정은
        카카오채널로 조율합니다.
      </p>
      <p>
        수령 가능일 안내 후 15일 이내 수령을 원칙으로 하며, 방문수령 선택 시
        배송비는 부과되지 않습니다.
      </p>
    </section>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
