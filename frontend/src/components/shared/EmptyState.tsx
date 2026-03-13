import { Inbox } from "lucide-react";
import { clsx } from "clsx";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function EmptyState({
  icon,
  title = "데이터가 없습니다",
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="mb-4 text-text-disabled">
        {icon || <Inbox className="h-12 w-12" />}
      </div>
      <h3 className="text-title-3 text-text-secondary">{title}</h3>
      {description && (
        <p className="mt-1 text-body-2 text-text-tertiary">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
