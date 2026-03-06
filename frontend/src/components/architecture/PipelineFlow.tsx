"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ProjectPipeline } from "@/lib/pipeline-data";
import PipelineNodeCard from "./PipelineNodeCard";

const nodeTypes: NodeTypes = {
  pipelineNode: PipelineNodeCard,
};

interface Props {
  pipeline: ProjectPipeline;
}

export default function PipelineFlow({ pipeline }: Props) {
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep" as const,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }),
    []
  );

  const onInit = useCallback(() => {
    // fitView is handled by the fitView prop
  }, []);

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <ReactFlow
        nodes={pipeline.nodes}
        edges={pipeline.edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll
        minZoom={0.3}
        maxZoom={1.5}
        onInit={onInit}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          className="!rounded-lg !border-slate-200 !bg-white !shadow-sm"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#e2e8f0"
        />
      </ReactFlow>

      {/* Infrastructure services bar */}
      {pipeline.infraServices.length > 0 && (
        <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Infrastructure
          </span>
          <div className="flex flex-wrap gap-2">
            {pipeline.infraServices.map((svc) => (
              <span
                key={svc}
                className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {svc}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
