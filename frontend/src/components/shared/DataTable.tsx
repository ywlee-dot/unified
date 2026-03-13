import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import EmptyState from "./EmptyState";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  emptyMessage?: string;
  className?: string;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  page,
  totalPages,
  onPageChange,
  emptyMessage = "데이터가 없습니다",
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className={clsx("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border-secondary">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "px-6 py-3 text-left text-[12px] font-semibold text-text-tertiary",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="border-b border-border-secondary transition-colors duration-150 last:border-0 hover:bg-surface-secondary/60"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "whitespace-nowrap px-6 py-4 text-[14px] text-text-primary",
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page !== undefined && totalPages !== undefined && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-border-secondary px-6 py-3">
          <span className="text-[12px] text-text-tertiary">
            {page} / {totalPages} 페이지
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              이전
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
