"use client";

import { LogOut, User, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-[52px] items-center justify-between border-b border-border-primary bg-surface-elevated px-6">
      {/* Search bar */}
      <div className="flex h-8 items-center gap-2 rounded-lg bg-surface-secondary px-3 text-text-tertiary transition-colors duration-150 hover:bg-surface-secondary/70 cursor-pointer">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[13px] text-text-disabled">검색</span>
        <kbd className="ml-1.5 rounded bg-surface-primary px-1.5 py-0.5 text-[11px] font-medium text-text-disabled">/</kbd>
      </div>
      {/* User area */}
      <div className="flex items-center gap-3">
        <span className="text-[14px] font-medium text-text-secondary">
          {user?.name || "로딩 중..."}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary text-text-tertiary">
          <User className="h-4 w-4" />
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-text-tertiary transition-colors hover:bg-surface-secondary"
          title="로그아웃"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
