"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { N8nRun, N8nTriggerResponse } from "@/lib/types";

const POLL_INTERVAL = 3000;

export function useN8nTrigger(slug: string) {
  const [runStatus, setRunStatus] = useState<N8nRun | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(
    (runId: string) => {
      stopPolling();
      setIsPolling(true);

      pollingRef.current = setInterval(async () => {
        try {
          const status = await api.getN8nRunStatus(slug, runId);
          setRunStatus(status);

          if (status.status === "completed" || status.status === "failed") {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      }, POLL_INTERVAL);
    },
    [slug, stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const mutation = useMutation({
    mutationFn: ({
      workflowId,
      params,
    }: {
      workflowId: string;
      params?: Record<string, string>;
    }) => api.triggerN8nWorkflow(slug, workflowId, params),
    onSuccess: (data: N8nTriggerResponse) => {
      setRunStatus({
        run_id: data.run_id,
        workflow_id: "",
        workflow_name: "",
        status: "running",
        started_at: new Date().toISOString(),
        finished_at: null,
        result_data: null,
        download_url: null,
        error_message: null,
      });
      startPolling(data.run_id);
    },
  });

  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const trigger = useCallback(
    (workflowId: string, params?: Record<string, string>) => {
      setRunStatus(null);
      mutateRef.current({ workflowId, params });
    },
    []
  );

  return {
    trigger,
    runStatus,
    isRunning: mutation.isPending || isPolling,
    result: runStatus?.status === "completed" ? runStatus : null,
    error: mutation.error || (runStatus?.status === "failed" ? runStatus.error_message : null),
  };
}
