"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export interface LayerGroupData {
  label: string;
  sublabel: string;
  layerType: "frontend" | "backend" | "external" | "data";
  [key: string]: unknown;
}

const LAYER_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
  frontend: { bg: "bg-blue-50/40",   border: "border-blue-300/60",   badge: "bg-blue-100 text-blue-700" },
  backend:  { bg: "bg-green-50/40",  border: "border-green-300/60",  badge: "bg-green-100 text-green-700" },
  external: { bg: "bg-violet-50/40", border: "border-violet-300/60", badge: "bg-violet-100 text-violet-700" },
  data:     { bg: "bg-amber-50/40",  border: "border-amber-300/60",  badge: "bg-amber-100 text-amber-700" },
};

function LayerGroupNode({ data }: NodeProps) {
  const d = data as unknown as LayerGroupData;
  const s = LAYER_STYLES[d.layerType] || LAYER_STYLES.backend;

  return (
    <div className={`h-full w-full rounded-2xl border-2 border-dashed ${s.border} ${s.bg} px-4 pt-2.5`}>
      <div className="flex items-center gap-2.5">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.badge}`}>
          {d.label}
        </span>
        <span className="text-[10px] text-slate-400">
          {d.sublabel}
        </span>
      </div>
    </div>
  );
}

export default memo(LayerGroupNode);
