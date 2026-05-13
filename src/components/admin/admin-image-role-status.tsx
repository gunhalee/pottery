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
  issuePrefix = "諛쒗뻾 李⑤떒:",
  issueSeparator = " 쨌 ",
  requiredEmptyText = "諛쒗뻾 ?꾩닔 variant ?놁쓬",
  requiredPrefix = "?꾩슂:",
  roleLabel = "?몄텧 ?꾩튂",
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
