"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { N8nRun } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import { Loader2 } from "lucide-react";

interface PipelineStatusProps {
  slug: string;
  runId: string;
  onComplete?: (run: N8nRun) => void;
}

export default function PipelineStatus({
  slug,
  runId,
  onComplete,
}: PipelineStatusProps) {
  const [run, setRun] = useState<N8nRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!runId) return;

    const poll = async () => {
      try {
        const status = await api.getN8nRunStatus(slug, runId);
        setRun(status);

        if (status.status === "completed" || status.status === "failed") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (status.status === "completed" && onComplete) {
            onComplete(status);
          }
        }
      } catch {
        setError("상태 조회에 실패했습니다");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [slug, runId, onComplete]);

  if (error) {
    return <span className="text-sm text-red-500">{error}</span>;
  }

  if (!run) {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-gray-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        상태 확인 중...
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <StatusBadge status={run.status} />
      {run.status === "running" && (
        <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
      )}
    </div>
  );
}
