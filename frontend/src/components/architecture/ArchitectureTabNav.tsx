"use client";

import { clsx } from "clsx";
import { ARCH_TYPE_LABELS, type ArchType } from "@/lib/architecture-data";

const TAB_ORDER: ArchType[] = ["system", "network", "software", "data", "integration", "application"];

interface Props {
  activeTab: ArchType;
  onTabChange: (tab: ArchType) => void;
}

export default function ArchitectureTabNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto px-1">
        {TAB_ORDER.map((tab) => {
          const { label } = ARCH_TYPE_LABELS[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={clsx(
                "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
