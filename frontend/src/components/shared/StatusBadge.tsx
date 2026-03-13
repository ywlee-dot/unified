import { clsx } from "clsx";

type StatusType =
  | "active"
  | "paused"
  | "error"
  | "completed"
  | "running"
  | "success"
  | "failed"
  | "pending"
  | "sent"
  | "delivered"
  | "draft"
  | "review"
  | "published"
  | "archived"
  | "triggered"
  | "queued"
  | "inactive";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-positive-bg text-positive",
  success: "bg-positive-bg text-positive",
  completed: "bg-positive-bg text-positive",
  delivered: "bg-positive-bg text-positive",
  published: "bg-positive-bg text-positive",
  running: "bg-warning-bg text-warning",
  pending: "bg-warning-bg text-warning",
  triggered: "bg-brand-light text-brand",
  queued: "bg-brand-light text-brand",
  sent: "bg-brand-light text-brand",
  paused: "bg-surface-secondary text-text-tertiary",
  inactive: "bg-surface-secondary text-text-tertiary",
  draft: "bg-surface-secondary text-text-tertiary",
  archived: "bg-surface-secondary text-text-tertiary",
  error: "bg-negative-bg text-negative",
  failed: "bg-negative-bg text-negative",
  review: "bg-brand-light text-brand",
};

const STATUS_LABELS: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  error: "오류",
  completed: "완료",
  running: "실행 중",
  success: "성공",
  failed: "실패",
  pending: "대기",
  sent: "발송",
  delivered: "전달됨",
  draft: "임시저장",
  review: "검토 중",
  published: "게시됨",
  archived: "보관됨",
  triggered: "트리거됨",
  queued: "대기열",
  inactive: "비활성",
};

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || "bg-surface-secondary text-text-tertiary";
  const label = STATUS_LABELS[status] || status;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-caption-2 font-medium",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
