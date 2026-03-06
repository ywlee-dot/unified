"use client";

import { useState } from "react";
import { UNIFIED_DIAGRAMS, ARCH_TYPE_LABELS, type ArchType } from "@/lib/architecture-data";
import ArchitectureTabNav from "@/components/architecture/ArchitectureTabNav";
import ArchitectureDiagram from "@/components/architecture/ArchitectureDiagram";

export default function UnifiedArchitecturePage() {
  const [activeTab, setActiveTab] = useState<ArchType>("system");
  const diagram = UNIFIED_DIAGRAMS[activeTab];
  const meta = ARCH_TYPE_LABELS[activeTab];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Unified Workspace 아키텍처
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          전체 시스템의 6가지 아키텍처 다이어그램
        </p>
      </div>

      <ArchitectureTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{diagram.title}</h2>
          <p className="text-sm text-slate-500">{meta.description}</p>
        </div>
        <ArchitectureDiagram diagram={diagram} />
      </div>
    </div>
  );
}
