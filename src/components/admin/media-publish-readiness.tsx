type MediaPublishReadinessProps = {
  okText: string;
  issues: string[];
};

export function MediaPublishReadiness({
  issues,
  okText,
}: MediaPublishReadinessProps) {
  return (
    <div
      className={`admin-publish-readiness ${
        issues.length > 0
          ? "admin-publish-readiness-warning"
          : "admin-publish-readiness-ok"
      }`}
    >
      <strong>{issues.length > 0 ? "발행 전 확인" : "발행 이미지 준비됨"}</strong>
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <span>{okText}</span>
      )}
    </div>
  );
}
