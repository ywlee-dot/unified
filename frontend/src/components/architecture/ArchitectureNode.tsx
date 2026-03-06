"use client";

import { clsx } from "clsx";
import { COLOR_CLASS_MAP, type ArchNode } from "@/lib/architecture-data";

interface Props {
  node: ArchNode;
  highlighted: boolean;
}

export default function ArchitectureNode({ node, highlighted }: Props) {
  const colors = COLOR_CLASS_MAP[node.colorKey];
  const w = node.width ?? 160;
  const h = node.height ?? 72;

  return (
    <div
      className={clsx(
        "absolute flex flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-all duration-200 ease-in-out",
        highlighted
          ? `bg-gradient-to-br ${colors.gradient} ${colors.border} shadow-lg ${colors.shadow} hover:shadow-xl hover:scale-[1.02] cursor-default`
          : "bg-slate-100 border-slate-200 opacity-40"
      )}
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: `${w}px`,
        height: `${h}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span
        className={clsx(
          "text-sm font-semibold leading-tight",
          highlighted ? colors.text : "text-slate-400"
        )}
      >
        {node.label}
      </span>
      {node.sublabel && (
        <span
          className={clsx(
            "mt-0.5 text-xs leading-tight",
            highlighted ? "text-slate-500" : "text-slate-300"
          )}
        >
          {node.sublabel}
        </span>
      )}
    </div>
  );
}
