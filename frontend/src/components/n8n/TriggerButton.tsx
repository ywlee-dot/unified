"use client";

import { Play, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface TriggerButtonProps {
  label?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export default function TriggerButton({
  label = "실행하기",
  isLoading = false,
  disabled = false,
  onClick,
  className,
}: TriggerButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={clsx(
        "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
        isLoading || disabled
          ? "cursor-not-allowed bg-gray-400"
          : "bg-green-600 hover:bg-green-700",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      {isLoading ? "실행 중..." : label}
    </button>
  );
}
