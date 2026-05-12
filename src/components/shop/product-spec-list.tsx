export type ProductSpecListItem = {
  label: string;
  value?: string | null;
};

export function ProductSpecList({
  items,
}: {
  items: ReadonlyArray<ProductSpecListItem>;
}) {
  const visibleItems = items.filter(hasProductSpecValue);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section
      className="product-detail-section product-spec-section"
      aria-label="제품 상세 정보"
    >
      <dl className="product-spec-list">
        {visibleItems.map(({ label, value }) => (
          <div className="product-spec-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function hasProductSpecValue(
  item: ProductSpecListItem,
): item is Required<ProductSpecListItem> {
  return typeof item.value === "string" && item.value.trim().length > 0;
}
