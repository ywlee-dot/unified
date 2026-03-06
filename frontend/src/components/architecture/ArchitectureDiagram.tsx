"use client";

import { useMemo } from "react";
import type { ArchDiagram } from "@/lib/architecture-data";
import ArchitectureNode from "./ArchitectureNode";
import ArchitectureEdge from "./ArchitectureEdge";

interface Props {
  diagram: ArchDiagram;
  highlightNodeIds?: string[];
}

export default function ArchitectureDiagram({ diagram, highlightNodeIds }: Props) {
  const nodeMap = useMemo(
    () => new Map(diagram.nodes.map((n) => [n.id, n])),
    [diagram.nodes]
  );

  const highlightSet = useMemo(
    () => (highlightNodeIds ? new Set(highlightNodeIds) : null),
    [highlightNodeIds]
  );

  const isNodeHighlighted = (nodeId: string) =>
    highlightSet === null || highlightSet.has(nodeId);

  const isEdgeHighlighted = (fromId: string, toId: string) =>
    highlightSet === null || (highlightSet.has(fromId) && highlightSet.has(toId));

  return (
    <div className="relative min-h-[600px] w-full overflow-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white">
      {/* Dot grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* SVG edges layer */}
      <svg className="absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>
        {diagram.edges.map((edge) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;
          return (
            <ArchitectureEdge
              key={edge.id}
              edge={edge}
              fromNode={fromNode}
              toNode={toNode}
              highlighted={isEdgeHighlighted(edge.from, edge.to)}
            />
          );
        })}
      </svg>

      {/* HTML nodes layer */}
      <div className="relative h-full min-h-[600px] w-full" style={{ zIndex: 2 }}>
        {diagram.nodes.map((node) => (
          <ArchitectureNode
            key={node.id}
            node={node}
            highlighted={isNodeHighlighted(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
