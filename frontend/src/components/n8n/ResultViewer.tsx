import { Download, FileJson } from "lucide-react";
import type { N8nRun } from "@/lib/types";

interface ResultViewerProps {
  run: N8nRun;
}

export default function ResultViewer({ run }: ResultViewerProps) {
  if (run.status === "running") {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        워크플로우가 실행 중입니다...
      </div>
    );
  }

  if (run.status === "failed") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">실행 실패</p>
        {run.error_message && <p className="mt-1">{run.error_message}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">실행 결과</span>
        </div>
        {run.download_url && (
          <a
            href={run.download_url}
            className="inline-flex items-center gap-1 rounded-md bg-primary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600"
            download
          >
            <Download className="h-3 w-3" />
            다운로드
          </a>
        )}
      </div>
      {run.result_data && (
        <pre className="max-h-64 overflow-auto p-4 text-xs text-gray-700">
          {JSON.stringify(run.result_data, null, 2)}
        </pre>
      )}
      {!run.result_data && (
        <p className="p-4 text-sm text-gray-500">결과 데이터가 없습니다.</p>
      )}
    </div>
  );
}
