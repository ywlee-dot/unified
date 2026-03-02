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
  active: "bg-green-100 text-green-800",
  success: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  delivered: "bg-blue-100 text-blue-800",
  published: "bg-blue-100 text-blue-800",
  running: "bg-yellow-100 text-yellow-800",
  pending: "bg-yellow-100 text-yellow-800",
  queued: "bg-yellow-100 text-yellow-800",
  triggered: "bg-yellow-100 text-yellow-800",
  paused: "bg-gray-100 text-gray-800",
  inactive: "bg-gray-100 text-gray-800",
  draft: "bg-gray-100 text-gray-800",
  archived: "bg-gray-100 text-gray-800",
  error: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  sent: "bg-indigo-100 text-indigo-800",
  review: "bg-purple-100 text-purple-800",
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
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-800";
  const label = STATUS_LABELS[status] || status;

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
