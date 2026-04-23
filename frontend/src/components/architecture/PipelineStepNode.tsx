"use client";

import { memo, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface StepNodeData {
  label: string;
  step?: number;
  color?: string;
  sublabel?: string;
  [key: string]: unknown;
}

// 숨겨진 오프셋 핸들 — 같은 면에 여러 엣지가 들어올 때 간격을 주기 위한 앵커 포인트
const off: CSSProperties = { opacity: 0, pointerEvents: "none" };

function PipelineStepNode({ data }: NodeProps) {
  const d = data as unknown as StepNodeData;
  const color = d.color ?? "#3182f6";

  return (
    <>
      {/* LEFT — 가시적 기본(50%) + 오프셋(30%/70%) */}
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-gray-300 !bg-white" />
      <Handle type="target" position={Position.Left} id="target-left-top" style={{ top: "30%", ...off }} />
      <Handle type="target" position={Position.Left} id="target-left-bot" style={{ top: "70%", ...off }} />
      <Handle type="source" position={Position.Left} id="source-left" className="!h-2 !w-2 !border !border-gray-300 !bg-white" />
      <Handle type="source" position={Position.Left} id="source-left-top" style={{ top: "30%", ...off }} />
      <Handle type="source" position={Position.Left} id="source-left-bot" style={{ top: "70%", ...off }} />

      {/* RIGHT */}
      <Handle type="target" position={Position.Right} id="target-right" className="!h-2 !w-2 !border !border-gray-300 !bg-white" />
      <Handle type="target" position={Position.Right} id="target-right-top" style={{ top: "30%", ...off }} />
      <Handle type="target" position={Position.Right} id="target-right-bot" style={{ top: "70%", ...off }} />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-gray-300 !bg-white" />
      <Handle type="source" position={Position.Right} id="source-right-top" style={{ top: "30%", ...off }} />
      <Handle type="source" position={Position.Right} id="source-right-bot" style={{ top: "70%", ...off }} />

      {/* TOP */}
      <Handle type="target" position={Position.Top} id="target-top" className="!h-2 !w-2 !border !border-gray-300 !bg-white" />
      <Handle type="target" position={Position.Top} id="target-top-left" style={{ left: "30%", ...off }} />
      <Handle type="target" position={Position.Top} id="target-top-right" style={{ left: "70%", ...off }} />
      <Handle type="source" position={Position.Top} id="source-top" className="!h-2 !w-2 !border !border-gray-300 !bg-white" />
      <Handle type="source" position={Position.Top} id="source-top-left" style={{ left: "30%", ...off }} />
      <Handle type="source" position={Position.Top} id="source-top-right" style={{ left: "70%", ...off }} />

      {/* BOTTOM */}
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!h-2 !w-2 !border !border-gray-300 !bg-white" />
      <Handle type="target" position={Position.Bottom} id="target-bottom-left" style={{ left: "30%", ...off }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom-right" style={{ left: "70%", ...off }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!h-2 !w-2 !border !border-gray-300 !bg-white" />
      <Handle type="source" position={Position.Bottom} id="source-bottom-left" style={{ left: "30%", ...off }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom-right" style={{ left: "70%", ...off }} />

      <div
        className="flex flex-col items-start justify-center rounded-xl bg-white shadow-md px-3"
        style={{ width: 180, height: 68, border: "1px solid #e5e7eb" }}
      >
        {d.step !== undefined && (
          <span className="text-[10px] font-semibold tracking-wide" style={{ color }}>
            STEP {d.step}.
          </span>
        )}
        <span className="mt-0.5 text-left text-[12px] font-medium leading-tight text-gray-700">
          {d.label}
        </span>
        {d.sublabel && (
          <span className="text-[10px] leading-tight mt-0.5" style={{ color: "#9ca3af" }}>
            {d.sublabel}
          </span>
        )}
      </div>
    </>
  );
}

export default memo(PipelineStepNode);
