"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { clsx } from "clsx";
import {
  Upload,
  Cpu,
  Server,
  Database,
  CheckCircle,
  Sparkles,
  Search,
  Play,
  Type,
  FileOutput,
  Settings,
  Globe,
} from "lucide-react";
import {
  NODE_TYPE_STYLES,
  RUNTIME_STYLES,
  type PipelineNodeData,
} from "@/lib/pipeline-data";

const ICON_MAP: Record<string, React.ReactNode> = {
  upload: <Upload className="h-4 w-4" />,
  cpu: <Cpu className="h-4 w-4" />,
  server: <Server className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  "check-circle": <CheckCircle className="h-4 w-4" />,
  sparkles: <Sparkles className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  play: <Play className="h-4 w-4" />,
  type: <Type className="h-4 w-4" />,
  "file-output": <FileOutput className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  webhook: <Globe className="h-4 w-4" />,
  globe: <Globe className="h-4 w-4" />,
};

function PipelineNodeCard({ data }: NodeProps) {
  const nodeData = data as unknown as PipelineNodeData;
  const styles = NODE_TYPE_STYLES[nodeData.nodeType];
  const runtime = RUNTIME_STYLES[nodeData.runtime];
  const iconKey = nodeData.icon || styles.iconName;
  const icon = ICON_MAP[iconKey];

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-slate-300 !bg-white"
      />
      <div
        className={clsx(
          "w-[200px] rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md",
          "border-l-4",
          styles.border
        )}
      >
        {/* Header */}
        <div className={clsx("flex items-start gap-2 px-3 pt-3 pb-1", styles.bg)}>
          {icon && (
            <span className={clsx("mt-0.5 shrink-0", styles.text)}>{icon}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className={clsx("text-sm font-semibold leading-tight", styles.text)}>
              {nodeData.label}
            </p>
            {nodeData.sublabel && (
              <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">
                {nodeData.sublabel}
              </p>
            )}
          </div>
        </div>
        {/* Runtime badge */}
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span
            className={clsx(
              "inline-block h-2 w-2 rounded-full",
              runtime.color
            )}
          />
          <span className="text-[10px] font-medium text-slate-500">
            {nodeData.runtimeLabel || runtime.label}
          </span>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-slate-300 !bg-white"
      />
    </>
  );
}

export default memo(PipelineNodeCard);
