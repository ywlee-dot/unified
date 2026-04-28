"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, Upload, FileSpreadsheet, X, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { DatasetSummaryResult } from "@/lib/types";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import {
  HwpDocumentPreview,
  type HwpDocumentData,
} from "@/components/shared/HwpDocumentPreview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

type ResultViewMode = "default" | "hwp";

function buildSummaryHwpData(
  results: DatasetSummaryResult[],
  orgName: string,
  filename: string,
): HwpDocumentData {
  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  const labelStyle = { bold: true, bg: "#F4F5F8", align: "center" as const };

  return {
    title: "데이터셋 설명·키워드 자동생성 결과",
    subtitle: `${orgName} · ${filename}`,
    date: dateStr,
    sections: results.map((item) => {
      const common = item.common || {};
      return {
        heading: `[${item.row_index}] ${common["데이터셋명"] || "(데이터셋명 없음)"}`,
        table: {
          columnWidths: Array(24).fill(1),
          rows: [
            [
              { value: "번호", colspan: 4, ...labelStyle },
              { value: String(item.row_index ?? "-"), colspan: 4, align: "center" },
              { value: "대분류", colspan: 4, ...labelStyle },
              { value: common["대분류"] || "-", colspan: 4 },
              { value: "소분류", colspan: 4, ...labelStyle },
              { value: common["소분류"] || "-", colspan: 4 },
            ],
            [
              { value: "데이터셋명", colspan: 4, ...labelStyle },
              { value: common["데이터셋명"] || "-", bold: true, colspan: 8 },
              { value: "테이블명", colspan: 4, ...labelStyle },
              { value: common["테이블명"] || "-", colspan: 8 },
            ],
            [
              { value: "키워드", colspan: 4, ...labelStyle },
              { value: (item.keywords || []).join(", "), colspan: 20 },
            ],
            [
              { value: "설명", colspan: 4, ...labelStyle },
              { value: item.description || "", colspan: 20 },
            ],
          ],
        },
      };
    }),
  };
}

function ViewModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap"
      style={{
        backgroundColor: active ? "#FFFFFF" : "transparent",
        color: active ? "#191F28" : "#8B95A1",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {children}
    </button>
  );
}

export default function DatasetSummaryPage() {
  const [file, setFile] = useState<File | null>(null);
  const [orgName, setOrgName] = useState("");
  const [sheet, setSheet] = useState("");
  const [useMock, setUseMock] = useState(false);
  const [includePrompt, setIncludePrompt] = useState(false);
  const [includeRows, setIncludeRows] = useState(false);

  const [results, setResults] = useState<DatasetSummaryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ResultViewMode>("default");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "csv") {
      setError(".xlsx 또는 .csv 파일만 지원합니다.");
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleSubmit = async () => {
    if (!file) {
      setError("파일을 선택해주세요.");
      return;
    }
    if (!orgName.trim()) {
      setError("기관명을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setProgress(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("org_name", orgName.trim());
    if (sheet.trim()) formData.append("sheet", sheet.trim());
    formData.append("mock", String(useMock));
    formData.append("include_prompt", String(includePrompt));
    formData.append("include_rows", String(includeRows));

    try {
      const start = await api.postFormData<{
        execution_id: string;
        status: string;
        total: number;
      }>("/projects/dataset-summary/summarize", formData);

      const execId = start.execution_id;
      setExecutionId(execId);
      setProgress({ done: 0, total: start.total });

      while (true) {
        await new Promise((r) => setTimeout(r, 1500));
        const prog = await api.get<{
          done: number;
          total: number;
          status: string;
          error: string | null;
        }>(`/projects/dataset-summary/summarize/progress/${execId}`);

        if (prog.total > 0) setProgress({ done: prog.done, total: prog.total });

        if (prog.status === "succeeded") {
          const detail = await api.get<{
            result_data: { response: { results: DatasetSummaryResult[] } };
          }>(`/projects/dataset-summary/runs/${execId}`);
          setResults(detail.result_data?.response?.results ?? []);
          break;
        }
        if (prog.status === "failed") {
          throw new Error(prog.error || "생성 실패");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleExport = async () => {
    if (!executionId) return;
    try {
      const resp = await fetch(
        `${API_BASE}/projects/dataset-summary/runs/${executionId}/export`,
        { credentials: "include" }
      );
      if (!resp.ok) throw new Error("내보내기 실패");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `데이터셋설명키워드_${executionId.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "내보내기 실패");
    }
  };

  const toggleCard = (idx: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const copyToClipboard = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const inputStyle = {
    backgroundColor: "#F0F1F4",
    borderRadius: "10px",
    border: "none",
    padding: "8px 12px",
    fontSize: "14px",
    color: "#191F28",
    outline: "none",
    width: "100%",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#191F28" }}>
          데이터셋 설명/키워드 자동생성
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#8B95A1" }}>
          데이터셋 정의서(Excel/CSV)를 업로드하면 LLM이 키워드 8개와 설명문을
          자동 생성합니다
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left: Upload + Settings */}
        <div className="space-y-4 lg:col-span-1">
          {/* Settings panel */}
          <div
            className="rounded-xl shadow-md p-5 space-y-4"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E8EB",
            }}
          >
            {/* File Upload area */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "#4E5968" }}
              >
                파일 업로드
              </label>
              <div
                ref={dropRef}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg p-6 transition-colors"
                style={{
                  border: `2px dashed ${dragOver ? "#0064FF" : file ? "#00B386" : "#E5E8EB"}`,
                  backgroundColor: dragOver
                    ? "#E8F1FF"
                    : file
                    ? "#E6F9F3"
                    : "#F4F5F8",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                {file ? (
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" style={{ color: "#00B386" }} />
                    <span className="text-sm font-medium truncate max-w-[160px]" style={{ color: "#00B386" }}>
                      {file.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="ml-1 rounded p-0.5 transition-colors shrink-0"
                      style={{ color: "#8B95A1" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#4E5968")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#8B95A1")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-7 w-7" style={{ color: "#B0B8C1" }} />
                    <p className="text-sm" style={{ color: "#4E5968" }}>
                      파일을 드래그하거나 클릭하여 선택
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#8B95A1" }}>
                      .xlsx, .csv
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid #F0F1F4" }} />

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
                  기관명 <span style={{ color: "#F04452" }}>*</span>
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="예: 한국토지주택공사"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,100,255,0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
                  시트명 (선택)
                </label>
                <input
                  type="text"
                  value={sheet}
                  onChange={(e) => setSheet(e.target.value)}
                  placeholder="기본: 첫 번째 시트"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,100,255,0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Options (checkboxes) */}
            <div className="space-y-2.5" style={{ borderTop: "1px solid #F0F1F4", paddingTop: "12px" }}>
              {[
                { label: "모의 테스트 (LLM 미호출)", checked: useMock, onChange: setUseMock },
                { label: "프롬프트 보기", checked: includePrompt, onChange: setIncludePrompt },
                { label: "원본 행 보기", checked: includeRows, onChange: setIncludeRows },
              ].map(({ label, checked, onChange }) => (
                <label
                  key={label}
                  className="relative flex items-center gap-2.5 text-sm cursor-pointer select-none"
                  style={{ color: "#4E5968" }}
                >
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded transition-colors shrink-0"
                    style={{
                      backgroundColor: checked ? "#0064FF" : "#F0F1F4",
                      border: checked ? "none" : "1.5px solid #B0B8C1",
                    }}
                    onClick={() => onChange(!checked)}
                  >
                    {checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !file || !orgName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
            style={{
              backgroundColor: loading || !file || !orgName.trim() ? "#B0B8C1" : "#0064FF",
            }}
            onMouseEnter={(e) => {
              if (!loading && file && orgName.trim()) e.currentTarget.style.backgroundColor = "#0050CC";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = loading || !file || !orgName.trim() ? "#B0B8C1" : "#0064FF";
            }}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                생성하기
              </>
            )}
          </button>

          {error && (
            <div
              className="rounded-lg p-3 text-sm"
              style={{
                backgroundColor: "#FFF0F1",
                color: "#F04452",
                border: "1px solid rgba(240,68,82,0.2)",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="min-w-0 lg:col-span-2">
          {results.length === 0 && !loading && (
            <div
              className="flex h-64 flex-col items-center justify-center rounded-xl"
              style={{
                border: "2px dashed #E5E8EB",
                backgroundColor: "#F4F5F8",
              }}
            >
              <Sparkles className="mb-3 h-10 w-10" style={{ color: "#B0B8C1" }} />
              <p className="text-sm" style={{ color: "#8B95A1" }}>
                파일을 업로드하고 생성하기를 눌러주세요
              </p>
            </div>
          )}

          {loading && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-sm" style={{ color: "#8B95A1" }}>
                  LLM이 설명문과 키워드를 생성하고 있습니다...
                </p>
                {progress && progress.total > 0 && (
                  <p className="mt-1 text-xs" style={{ color: "#B0B8C1" }}>
                    {progress.done} / {progress.total} ({Math.round((progress.done / progress.total) * 100)}%)
                  </p>
                )}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold" style={{ color: "#191F28" }}>
                  생성 결과{" "}
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#8B95A1" }}
                  >
                    ({results.length}건)
                  </span>
                </h2>
                <div className="flex items-center gap-3">
                  <div
                    className="inline-flex gap-1 p-1 rounded-lg"
                    style={{ backgroundColor: "#F0F1F4" }}
                  >
                    <ViewModeButton
                      active={viewMode === "default"}
                      onClick={() => setViewMode("default")}
                    >
                      기본 보기
                    </ViewModeButton>
                    <ViewModeButton
                      active={viewMode === "hwp"}
                      onClick={() => setViewMode("hwp")}
                    >
                      HWP 보기
                    </ViewModeButton>
                  </div>
                  {executionId && (
                    <button
                      onClick={handleExport}
                      className="px-3 py-1.5 text-sm rounded-lg font-medium"
                      style={{ backgroundColor: "#00B386", color: "#FFFFFF" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#009E77")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00B386")}
                    >
                      엑셀 내보내기
                    </button>
                  )}
                </div>
              </div>

              {viewMode === "hwp" && (
                <HwpDocumentPreview
                  data={buildSummaryHwpData(results, orgName.trim() || "-", file?.name || "-")}
                />
              )}

              {viewMode === "default" && results.map((item, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-lg shadow-sm"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E8EB",
                  }}
                >
                  {/* Card Header */}
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors"
                    style={{ borderBottom: "1px solid #F0F1F4" }}
                    onClick={() => toggleCard(idx)}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F4F5F8")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: "#E8F1FF",
                          color: "#0064FF",
                        }}
                      >
                        {item.row_index}
                      </span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#191F28" }}>
                          {item.common["데이터셋명"] ||
                            item.group_key ||
                            `그룹 ${item.row_index}`}
                        </p>
                        {item.common["테이블명"] && (
                          <p className="text-xs" style={{ color: "#8B95A1" }}>
                            {item.common["테이블명"]}
                          </p>
                        )}
                      </div>
                    </div>
                    {expandedCards.has(idx) ? (
                      <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "#8B95A1" }} />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#8B95A1" }} />
                    )}
                  </div>

                  {/* Keywords */}
                  <div
                    className="flex flex-wrap gap-1.5 px-4 py-3"
                    style={{ borderBottom: "1px solid #F0F1F4" }}
                  >
                    {item.keywords.map((kw, kwIdx) => (
                      <span
                        key={kwIdx}
                        className="inline-flex rounded text-xs font-medium px-2.5 py-1"
                        style={{
                          backgroundColor: "#E8F1FF",
                          color: "#0064FF",
                          borderRadius: "6px",
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "#4E5968" }}
                      >
                        {item.description}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(item.description, idx);
                        }}
                        className="shrink-0 rounded p-1.5 transition-colors"
                        style={{ color: "#8B95A1" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#F0F1F4";
                          e.currentTarget.style.color = "#4E5968";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#8B95A1";
                        }}
                        title="설명문 복사"
                      >
                        {copiedIdx === idx ? (
                          <Check className="h-4 w-4" style={{ color: "#00B386" }} />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedCards.has(idx) && (
                    <div
                      className="space-y-4 px-4 py-4"
                      style={{
                        borderTop: "1px solid #F0F1F4",
                        backgroundColor: "#F4F5F8",
                      }}
                    >
                      {Object.keys(item.common).length > 0 && (
                        <div>
                          <p
                            className="mb-2 text-xs font-semibold"
                            style={{ color: "#8B95A1" }}
                          >
                            공통 정보
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            {Object.entries(item.common).map(([k, v]) => (
                              <div key={k}>
                                <span style={{ color: "#8B95A1" }}>{k}: </span>
                                <span style={{ color: "#4E5968" }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.columns.length > 0 && (
                        <div>
                          <p
                            className="mb-2 text-xs font-semibold"
                            style={{ color: "#8B95A1" }}
                          >
                            컬럼 목록 ({item.columns.length}개)
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.columns.map((col, colIdx) => (
                              <span
                                key={colIdx}
                                className="inline-flex px-1.5 py-0.5 text-xs"
                                style={{
                                  backgroundColor: "#E8E9ED",
                                  color: "#4E5968",
                                  borderRadius: "6px",
                                }}
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.prompt && (
                        <div>
                          <p
                            className="mb-2 text-xs font-semibold"
                            style={{ color: "#8B95A1" }}
                          >
                            프롬프트
                          </p>
                          <pre
                            className="max-h-48 overflow-auto whitespace-pre-wrap break-all p-3 text-xs leading-relaxed font-mono"
                            style={{
                              backgroundColor: "#F0F1F4",
                              borderRadius: "10px",
                              color: "#4E5968",
                            }}
                          >
                            {item.prompt}
                          </pre>
                        </div>
                      )}

                      {item.rows && (
                        <div>
                          <p
                            className="mb-2 text-xs font-semibold"
                            style={{ color: "#8B95A1" }}
                          >
                            원본 행 ({item.rows.length}개)
                          </p>
                          <pre
                            className="max-h-48 overflow-auto whitespace-pre-wrap break-all p-3 text-xs leading-relaxed font-mono"
                            style={{
                              backgroundColor: "#F0F1F4",
                              borderRadius: "10px",
                              color: "#4E5968",
                            }}
                          >
                            {JSON.stringify(item.rows, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
