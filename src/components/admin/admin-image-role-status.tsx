import type { MediaEditorStatus } from "@/lib/media/media-editor-status";

type AdminImageRoleStatusProps = {
  issuePrefix?: string;
  issueSeparator?: string;
  requiredEmptyText?: string;
  requiredPrefix?: string;
  roleLabel?: string;
  status: MediaEditorStatus;
};

export function AdminImageRoleStatus({
  issuePrefix = "발행 차단:",
  issueSeparator = " · ",
  requiredEmptyText = "필수 variant 없음",
  requiredPrefix = "필수:",
  roleLabel = "노출 위치",
  status,
}: AdminImageRoleStatusProps) {
  return (
    <>
      <div className="admin-image-role-summary">
        <span>{roleLabel}</span>
        <strong>{status.exposureLabel}</strong>
      </div>
      <div className="admin-media-status-strip">
        <span
          className={`admin-media-status-pill admin-media-status-${status.variantTone}`}
        >
          {status.variantLabel}
        </span>
        {status.requiredVariants.length > 0 ? (
          <span>
            {requiredPrefix} {status.requiredVariants.join(" / ")}
          </span>
        ) : (
          <span>{requiredEmptyText}</span>
        )}
      </div>
      {status.publishIssues.length > 0 ? (
        <p className="admin-image-role-note admin-image-role-note-danger">
          {issuePrefix} {status.publishIssues.join(issueSeparator)}
        </p>
      ) : null}
    </>
  );
}
