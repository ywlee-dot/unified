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
        { method: "POST", body: formData, credentials: "include" }
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
        { method: "POST", body: formData, credentials: "include" }
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
          <h1 className="text-2xl font-bold" style={{ color: "#191F28" }}>
            개방 가능 여부 판단
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8B95A1" }}>
            엑셀 테이블 정의서를 업로드하면 LLM이 5단계로 공공데이터 개방 가능
            여부를 판단합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mock toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: "#4E5968" }}>
            <button
              role="switch"
              aria-checked={mockMode}
              onClick={() => setMockMode((v) => !v)}
              className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none"
              style={{
                backgroundColor: mockMode ? "#0064FF" : "#E8E9ED",
              }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                style={{
                  transform: mockMode ? "translateX(18px)" : "translateX(2px)",
                  marginTop: "2px",
                }}
              />
            </button>
            Mock 모드
          </label>

          {sessionId && (
            <button
              onClick={resetSession}
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: "#F0F1F4",
                color: "#4E5968",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
            >
              새 세션
            </button>
          )}
          {completedStages.size > 0 && (
            <button
              onClick={handleExport}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "#00B386",
                color: "#FFFFFF",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#009E77";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#00B386";
              }}
            >
              엑셀 내보내기
            </button>
          )}
        </div>
      </div>

      {/* Stage Indicator */}
      <div className="flex items-center">
        {STAGES.map((stage, idx) => {
          const isActive = activeStage === stage.num;
          const isCompleted = completedStages.has(stage.num);
          return (
            <div key={stage.num} className="flex items-center">
              <button
                onClick={() => setActiveStage(stage.num)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive
                    ? "#0064FF"
                    : isCompleted
                    ? "#E6F9F3"
                    : "#E8E9ED",
                  color: isActive
                    ? "#FFFFFF"
                    : isCompleted
                    ? "#00B386"
                    : "#8B95A1",
                }}
              >
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.25)"
                      : isCompleted
                      ? "#00B386"
                      : "#B0B8C1",
                    color: isActive
                      ? "#FFFFFF"
                      : isCompleted
                      ? "#FFFFFF"
                      : "#FFFFFF",
                  }}
                >
                  {isCompleted ? "✓" : stage.num}
                </span>
                {stage.label}
              </button>
              {idx < STAGES.length - 1 && (
                <div
                  className="w-6 h-0.5 mx-1"
                  style={{
                    backgroundColor: isCompleted ? "#00B386" : "#E5E8EB",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: "#FFF0F1",
            color: "#F04452",
            border: "1px solid #F04452",
            borderColor: "rgba(240,68,82,0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* Stage Content */}
      <div
        className="rounded-xl shadow-md"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E8EB",
        }}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold" style={{ color: "#191F28" }}>
            {STAGES[activeStage - 1].label}
          </h2>
          <p className="text-sm mt-1" style={{ color: "#8B95A1" }}>
            {STAGES[activeStage - 1].desc}
          </p>

          {/* Stage 1: File Upload */}
          {activeStage === 1 && !completedStages.has(1) && (
            <div className="mt-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="rounded-lg p-8 text-center transition-colors cursor-pointer"
                style={{
                  border: "2px dashed #E5E8EB",
                  backgroundColor: files.length > 0 ? "#E6F9F3" : "#FFFFFF",
                }}
                onMouseEnter={(e) => {
                  if (files.length === 0) {
                    e.currentTarget.style.borderColor = "#0064FF";
                    e.currentTarget.style.backgroundColor = "#E8F1FF";
                  }
                }}
                onMouseLeave={(e) => {
                  if (files.length === 0) {
                    e.currentTarget.style.borderColor = "#E5E8EB";
                    e.currentTarget.style.backgroundColor = "#FFFFFF";
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
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
                <div className="text-4xl mb-3">📁</div>
                <p className="text-sm" style={{ color: "#4E5968" }}>
                  엑셀 파일을 드래그하거나 클릭하여 선택하세요
                </p>
                <p className="text-xs mt-1" style={{ color: "#8B95A1" }}>
                  .xlsx, .xls 파일 지원 (다중 파일 가능)
                </p>
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-1">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md"
                      style={{
                        backgroundColor: "#F0F1F4",
                        color: "#4E5968",
                      }}
                    >
                      <span>📄</span>
                      <span>{f.name}</span>
                      <span style={{ color: "#8B95A1" }}>
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
                className="mt-4 px-6 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: "#0064FF",
                  color: "#FFFFFF",
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = "#0050CC";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#0064FF";
                }}
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
              <div className="flex flex-wrap gap-3 mb-4">
                <div
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: "#F4F5F8" }}
                >
                  <span style={{ color: "#8B95A1" }}>총 </span>
                  <span className="font-semibold" style={{ color: "#191F28" }}>
                    {currentResult.total}
                  </span>
                  <span style={{ color: "#8B95A1" }}>건</span>
                </div>
                {currentResult.openable_count !== undefined && (
                  <>
                    <div
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "#E6F9F3" }}
                    >
                      <span style={{ color: "#00B386" }}>개방 가능 </span>
                      <span className="font-semibold" style={{ color: "#00B386" }}>
                        {currentResult.openable_count}
                      </span>
                    </div>
                    <div
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "#FFF0F1" }}
                    >
                      <span style={{ color: "#F04452" }}>개방 불가 </span>
                      <span className="font-semibold" style={{ color: "#F04452" }}>
                        {currentResult.not_openable_count}
                      </span>
                    </div>
                  </>
                )}
                {currentResult.final_openable !== undefined && (
                  <>
                    <div
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "#E6F9F3" }}
                    >
                      <span style={{ color: "#00B386" }}>최종 가능 </span>
                      <span className="font-semibold" style={{ color: "#00B386" }}>
                        {currentResult.final_openable}
                      </span>
                    </div>
                    <div
                      className="px-4 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: "#FFF0F1" }}
                    >
                      <span style={{ color: "#F04452" }}>최종 불가 </span>
                      <span className="font-semibold" style={{ color: "#F04452" }}>
                        {currentResult.final_not_openable}
                      </span>
                    </div>
                  </>
                )}
                {currentResult.total_columns !== undefined && (
                  <div
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: "#E8F1FF" }}
                  >
                    <span style={{ color: "#0064FF" }}>핵심컬럼 </span>
                    <span className="font-semibold" style={{ color: "#0064FF" }}>
                      {currentResult.total_columns}
                    </span>
                  </div>
                )}
              </div>

              {/* Table */}
              <div
                className="overflow-x-auto rounded-lg"
                style={{ border: "1px solid #E5E8EB" }}
              >
                <table className="min-w-full divide-y text-sm" style={{ borderColor: "#E5E8EB" }}>
                  <thead style={{ backgroundColor: "#F4F5F8" }}>
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium"
                        style={{ color: "#8B95A1" }}
                      >
                        #
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-medium"
                        style={{ color: "#8B95A1" }}
                      >
                        테이블명
                      </th>
                      <StageHeaders stage={activeStage} />
                    </tr>
                  </thead>
                  <tbody>
                    {currentResult.rows.map(
                      (row: OpenDataStageRow, idx: number) => (
                        <tr
                          key={idx}
                          className="transition-colors"
                          style={{ borderTop: "1px solid #F0F1F4" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <td className="px-4 py-3" style={{ color: "#B0B8C1" }}>
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 font-medium" style={{ color: "#191F28" }}>
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
            <div className="mt-6 text-center py-8" style={{ color: "#B0B8C1" }}>
              결과를 불러오는 중...
            </div>
          )}
        </div>
      </div>

      {/* Session Info */}
      {sessionId && (
        <div className="text-xs" style={{ color: "#B0B8C1" }}>
          세션: {sessionId.slice(0, 12)}...
        </div>
      )}
    </div>
  );
}

function StageHeaders({ stage }: { stage: number }) {
  const thStyle = { color: "#8B95A1" };
  switch (stage) {
    case 1:
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            개방여부
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            사유번호
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            판단사유
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            신뢰도
          </th>
        </>
      );
    case 2:
      return (
        <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
          주제영역
        </th>
      );
    case 3:
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            핵심컬럼
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            데이터셋 설명
          </th>
        </>
      );
    case 4:
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            조인 테이블
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            조인 키
          </th>
        </>
      );
    case 5:
      return (
        <>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            데이터셋명
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
            최종개방여부
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium" style={thStyle}>
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
              className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
              style={
                row.openable === "가능"
                  ? { backgroundColor: "#E6F9F3", color: "#00B386" }
                  : row.openable === "불가능"
                  ? { backgroundColor: "#FFF0F1", color: "#F04452" }
                  : { backgroundColor: "#F0F1F4", color: "#8B95A1" }
              }
            >
              {row.openable || "-"}
            </span>
          </td>
          <td className="px-4 py-3" style={{ color: "#4E5968" }}>
            {row.reason_numbers?.join(", ") || "-"}
          </td>
          <td className="px-4 py-3 max-w-xs truncate" style={{ color: "#4E5968" }}>
            {row.reason_text || "-"}
          </td>
          <td className="px-4 py-3">
            <span
              className="text-xs font-medium"
              style={{
                color:
                  row.data_quality === "high"
                    ? "#00B386"
                    : row.data_quality === "medium"
                    ? "#FF8800"
                    : "#F04452",
              }}
            >
              {row.confidence ?? "-"}%
            </span>
          </td>
        </>
      );
    case 2:
      return (
        <td className="px-4 py-3">
          <span
            className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: "#E8F1FF", color: "#0064FF" }}
          >
            {row.subject_area || "-"}
          </span>
        </td>
      );
    case 3:
      return (
        <>
          <td className="px-4 py-3 max-w-xs" style={{ color: "#4E5968" }}>
            <div className="flex flex-wrap gap-1">
              {row.core_columns?.map((col, i) => (
                <span
                  key={i}
                  className="inline-flex px-1.5 py-0.5 rounded text-xs"
                  style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
                >
                  {col}
                </span>
              )) || "-"}
            </div>
          </td>
          <td className="px-4 py-3 max-w-xs truncate" style={{ color: "#4E5968" }}>
            {row.dataset_description || "-"}
          </td>
        </>
      );
    case 4:
      return (
        <>
          <td className="px-4 py-3" style={{ color: "#4E5968" }}>
            {row.join_table || "-"}
          </td>
          <td className="px-4 py-3" style={{ color: "#4E5968" }}>
            {row.join_keys?.join(", ") || "-"}
          </td>
        </>
      );
    case 5:
      return (
        <>
          <td className="px-4 py-3 font-medium" style={{ color: "#191F28" }}>
            {row.dataset_name || "-"}
          </td>
          <td className="px-4 py-3">
            <span
              className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
              style={
                row.final_openable === "가능"
                  ? { backgroundColor: "#E6F9F3", color: "#00B386" }
                  : row.final_openable === "불가능"
                  ? { backgroundColor: "#FFF0F1", color: "#F04452" }
                  : { backgroundColor: "#F0F1F4", color: "#8B95A1" }
              }
            >
              {row.final_openable || "-"}
            </span>
          </td>
          <td className="px-4 py-3 max-w-xs truncate" style={{ color: "#4E5968" }}>
            {row.final_reason || "-"}
          </td>
        </>
      );
    default:
      return null;
  }
}
