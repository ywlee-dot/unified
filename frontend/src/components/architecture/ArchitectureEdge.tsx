"use client";

import type { ArchEdge, ArchNode } from "@/lib/architecture-data";

interface Props {
  edge: ArchEdge;
  fromNode: ArchNode;
  toNode: ArchNode;
  highlighted: boolean;
}

export default function ArchitectureEdge({ edge, fromNode, toNode, highlighted }: Props) {
  const x1 = fromNode.x;
  const y1 = fromNode.y;
  const x2 = toNode.x;
  const y2 = toNode.y;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const strokeColor = highlighted ? "#3b82f6" : "#cbd5e1";
  const strokeWidth = highlighted ? 2 : 1;
  const opacity = highlighted ? 1 : 0.4;
  const dashArray = edge.style === "dashed" ? "6 4" : undefined;

  return (
    <g className="transition-opacity duration-200" style={{ opacity }}>
      <line
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        markerEnd="url(#arrowhead)"
      />
      {edge.label && (
        <text
          x={`${midX}%`}
          y={`${midY}%`}
          dy={-8}
          textAnchor="middle"
          className="fill-slate-500 text-[10px]"
          style={{ opacity: highlighted ? 1 : 0.5 }}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}
