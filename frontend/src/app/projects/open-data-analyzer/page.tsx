"use client";

import { useState, useRef, useCallback } from "react";
import type {
  OpenDataStageRow,
  OpenDataStageResponse,
} from "@/lib/types";

const API_BASE = "/api";

const STAGES = [
  { num: 1, label: "개방가능 여부", desc: "테이블별 개방 가능 여부 판단" },
  { num: 2, label: "주제영역 도출", desc: "개방 가능 테이블의 주제영역 분류" },
  { num: 3, label: "핵심컬럼 선정", desc: "데이터셋에 필요한 핵심 컬럼 선정" },
  { num: 4, label: "조인 검토", desc: "주제영역별 조인 가능성 검토" },
  { num: 5, label: "최종 점검", desc: "개방 데이터셋 최종 검토" },
];

export default function OpenDataAnalyzerPage() {
  const [activeStage, setActiveStage] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stageResults, setStageResults] = useState<
    Record<number, OpenDataStageResponse>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [completedStages, setCompletedStages] = useState<Set<number>>(
    new Set()
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) =>
        f.name.endsWith(".xlsx") ||
        f.name.endsWith(".xls")
    );
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
    }
  }, []);

  const runStage = async (stageNum: number) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      if (stageNum === 1) {
        if (files.length === 0 && !sessionId) {
          throw new Error("파일을 선택해주세요.");
        }
        files.forEach((f) => formData.append("columns_files", f));
        if (sessionId) {
          formData.append("session_id", sessionId);
        }
      } else {
        if (!sessionId) {
          throw new Error("먼저 1단계를 실행해주세요.");
        }
        formData.append("session_id", sessionId);
      }

      formData.append("mock", mockMode.toString());

      const resp = await fetch(
        `${API_BASE}/projects/open-data-analyzer/stage${stageNum}`,
        { method: "POST", body: formData }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(
          errData.detail || `Stage ${stageNum} 실행 실패 (${resp.status})`
        );
      }

      const data: OpenDataStageResponse = await resp.json();
      setSessionId(data.session_id);
      setStageResults((prev) => ({ ...prev, [stageNum]: data }));
      setCompletedStages((prev) => new Set([...prev, stageNum]));

      if (stageNum < 5) {
        setActiveStage(stageNum + 1);
      }
    } catch (err: any) {
      setError(err.message || "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);

      const resp = await fetch(
        `${API_BASE}/projects/open-data-analyzer/export`,
        { method: "POST", body: formData }
      );

      if (!resp.ok) {
        throw new Error("내보내기 실패");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `개방데이터분석결과_${sessionId.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setSessionId(null);
    setStageResults({});
    setCompletedStages(new Set());
    setFiles([]);
    setActiveStage(1);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const currentResult = stageResults[activeStage];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            개방 가능 여부 판단
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            엑셀 테이블 정의서를 업로드하면 LLM이 5단계로 공공데이터 개방 가능
            여부를 판단합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
              className="rounded border-gray-300"
            />
            Mock 모드
          </label>
          {sessionId && (
            <button
              onClick={resetSession}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              새 세션
            </button>
          )}
          {completedStages.size > 0 && (
            <button
              onClick={handleExport}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              엑셀 내보내기
            </button>
          )}
        </div>
      </div>

      {/* Stage Indicator */}
      <div className="flex items-center gap-1">
        {STAGES.map((stage, idx) => (
          <div key={stage.num} className="flex items-center">
            <button
              onClick={() => setActiveStage(stage.num)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeStage === stage.num
                  ? "bg-emerald-600 text-white shadow-sm"
                  : completedStages.has(stage.num)
                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  activeStage === stage.num
                    ? "bg-white text-emerald-600"
                    : completedStages.has(stage.num)
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-300 text-white"
                }`}
              >
                {completedStages.has(stage.num) ? "✓" : stage.num}
              </span>
              {stage.label}
            </button>
            {idx < STAGES.length - 1 && (
              <div
                className={`w-6 h-0.5 mx-1 ${
                  completedStages.has(stage.num)
                    ? "bg-emerald-400"
                    : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stage Content */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {STAGES[activeStage - 1].label}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {STAGES[activeStage - 1].desc}
          </p>

          {/* Stage 1: File Upload */}
          {activeStage === 1 && !completedStages.has(1) && (
            <div className="mt-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-400 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <div className="text-gray-400 text-4xl mb-3">📁</div>
                  <p className="text-sm text-gray-600">
                    엑셀 파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    .xlsx, .xls 파일 지원 (다중 파일 가능)
                  </p>
                </label>
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-1">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded"
                    >
                      <span>📄</span>
                      <span>{f.name}</span>
                      <span className="text-gray-400">
                        ({(f.size / 1024).toFixed(1)}KB)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Run Button */}
          {(activeStage === 1
            ? files.length > 0 || sessionId
            : completedStages.has(activeStage - 1)) &&
            !completedStages.has(activeStage) && (
              <button
                onClick={() => runStage(activeStage)}
                disabled={loading}
                className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    분석 중...
                  </span>
                ) : (
                  `${activeStage}단계 실행`
                )}
              </button>
            )}

          {/* Results */}
          {currentResult && (
            <div className="mt-6">
              {/* Stats */}
              <div className="flex gap-4 mb-4">
                <div className="bg-gray-50 px-4 py-2 rounded-lg text-sm">
                  <span className="text-gray-500">총 </span>
                  <span className="font-semibold text-gray-900">
                    {currentResult.total}
                  </span>
                  <span className="text-gray-500">건</span>
                </div>
                {currentResult.openable_count !== undefined && (
                  <>
                    <div className="bg-emerald-50 px-4 py-2 rounded-lg text-sm">
                      <span className="text-emerald-600">개방 가능 </span>
                      <span className="font-semibold text-emerald-700">
                        {currentResult.openable_count}
                      </span>
                    </div>
                    <div className="bg-red-50 px-4 py-2 rounded-lg text-sm">
                      <span className="text-red-600">개방 불가 </span>
                      <span className="font-semibold text-red-700">
                        {currentResult.not_openable_count}
                      </span>
                    </div>
                  </>
                )}
                {currentResult.final_openable !== undefined && (
                  <>
                    <div className="bg-emerald-50 px-4 py-2 rounded-lg text-sm">
                      <span className="text-emerald-600">최종 가능 </span>
                      <span className="font-semibold text-emerald-700">
                        {currentResult.final_openable}
                      </span>
                    </div>
                    <div className="bg-red-50 px-4 py-2 rounded-lg text-sm">
                      <span className="text-red-600">최종 불가 </span>
                      <span className="font-semibold text-red-700">
                        {currentResult.final_not_openable}
                      </span>
                    </div>
                  </>
                )}
                {currentResult.total_columns !== undefined && (
                  <div className="bg-blue-50 px-4 py-2 rounded-lg text-sm">
                    <span className="text-blue-600">핵심컬럼 </span>
                    <span className="font-semibold text-blue-700">
                      {currentResult.total_columns}
                    </span>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        #
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        테이블명
                      </th>
                      <StageHeaders stage={activeStage} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentResult.rows.map(
                      (row: OpenDataStageRow, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {row.table}
                          </td>
                          <StageCells stage={activeStage} row={row} />
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No results yet, stage is completed */}
          {completedStages.has(activeStage) && !currentResult && (
            <div className="mt-6 text-center text-gray-400 py-8">
              결과를 불러오는 중...
            </div>
          )}
        </div>
      </div>

      {/* Session Info */}
      {sessionId && (
        <div className="text-xs text-gray-400">
          세션: {sessionId.slice(0, 12)}...
        </div>
      )}
    </div>
  );
}

function StageHeaders({ stage }: { stage: number }) {
  switch (stage) {
    case 1:
      return (
        <>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            개방여부
          </th>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            사유번호
          </th>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            판단사유
          </th>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            신뢰도
          </th>
        </>
      );
    case 2:
      return (
        <th className="px-4 py-3 text-left font-medium text-gray-500">
          주제영역
        </th>
      );
    case 3:
      return (
        <>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            핵심컬럼
          </th>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            데이터셋 설명
          </th>
        </>
      );
    case 4:
      return (
        <>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            조인 테이블
          </th>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            조인 키
          </th>
        </>
      );
    case 5:
      return (
        <>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            데이터셋명
          </th>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            최종개방여부
          </th>
          <th className="px-4 py-3 text-left font-medium text-gray-500">
            판정사유
          </th>
        </>
      );
    default:
      return null;
  }
}

function StageCells({
  stage,
  row,
}: {
  stage: number;
  row: OpenDataStageRow;
}) {
  switch (stage) {
    case 1:
      return (
        <>
          <td className="px-4 py-3">
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                row.openable === "가능"
                  ? "bg-emerald-100 text-emerald-800"
                  : row.openable === "불가능"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {row.openable || "-"}
            </span>
          </td>
          <td className="px-4 py-3 text-gray-600">
            {row.reason_numbers?.join(", ") || "-"}
          </td>
          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
            {row.reason_text || "-"}
          </td>
          <td className="px-4 py-3">
            <span
              className={`text-xs font-medium ${
                row.data_quality === "high"
                  ? "text-emerald-600"
                  : row.data_quality === "medium"
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {row.confidence ?? "-"}%
            </span>
          </td>
        </>
      );
    case 2:
      return (
        <td className="px-4 py-3">
          <span className="inline-flex px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
            {row.subject_area || "-"}
          </span>
        </td>
      );
    case 3:
      return (
        <>
          <td className="px-4 py-3 text-gray-600 max-w-xs">
            <div className="flex flex-wrap gap-1">
              {row.core_columns?.map((col, i) => (
                <span
                  key={i}
                  className="inline-flex px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                >
                  {col}
                </span>
              )) || "-"}
            </div>
          </td>
          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
            {row.dataset_description || "-"}
          </td>
        </>
      );
    case 4:
      return (
        <>
          <td className="px-4 py-3 text-gray-600">
            {row.join_table || "-"}
          </td>
          <td className="px-4 py-3 text-gray-600">
            {row.join_keys?.join(", ") || "-"}
          </td>
        </>
      );
    case 5:
      return (
        <>
          <td className="px-4 py-3 font-medium text-gray-900">
            {row.dataset_name || "-"}
          </td>
          <td className="px-4 py-3">
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                row.final_openable === "가능"
                  ? "bg-emerald-100 text-emerald-800"
                  : row.final_openable === "불가능"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {row.final_openable || "-"}
            </span>
          </td>
          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
            {row.final_reason || "-"}
          </td>
        </>
      );
    default:
      return null;
  }
}
