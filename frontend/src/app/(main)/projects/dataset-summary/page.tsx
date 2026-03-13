"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, Upload, FileSpreadsheet, X, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { DatasetSummaryResult } from "@/lib/types";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

export default function DatasetSummaryPage() {
  const [file, setFile] = useState<File | null>(null);
  const [orgName, setOrgName] = useState("");
  const [sheet, setSheet] = useState("");
  const [groupKey, setGroupKey] = useState("");
  const [headerStart, setHeaderStart] = useState("");
  const [headerEnd, setHeaderEnd] = useState("");
  const [useMock, setUseMock] = useState(false);
  const [includePrompt, setIncludePrompt] = useState(false);
  const [includeRows, setIncludeRows] = useState(false);
  const [includeDebug, setIncludeDebug] = useState(false);

  const [results, setResults] = useState<DatasetSummaryResult[]>([]);
  const [debug, setDebug] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

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
    setDebug(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("org_name", orgName.trim());
    if (sheet.trim()) formData.append("sheet", sheet.trim());
    if (groupKey.trim()) formData.append("group_key", groupKey.trim());
    if (headerStart.trim()) formData.append("header_start", headerStart.trim());
    if (headerEnd.trim()) formData.append("header_end", headerEnd.trim());
    formData.append("mock", String(useMock));
    formData.append("include_prompt", String(includePrompt));
    formData.append("include_rows", String(includeRows));
    formData.append("include_debug", String(includeDebug));

    try {
      const res = await api.postFormData<{
        results: DatasetSummaryResult[];
        debug?: Record<string, unknown>;
      }>("/projects/dataset-summary/summarize", formData);
      setResults(res.results);
      if (res.debug) setDebug(res.debug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                    <span className="text-sm font-medium" style={{ color: "#00B386" }}>
                      {file.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="ml-1 rounded p-0.5 transition-colors"
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

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
                  그룹 키 컬럼 (선택)
                </label>
                <input
                  type="text"
                  value={groupKey}
                  onChange={(e) => setGroupKey(e.target.value)}
                  placeholder="자동 감지"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,100,255,0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
                    헤더 시작 셀
                  </label>
                  <input
                    type="text"
                    value={headerStart}
                    onChange={(e) => setHeaderStart(e.target.value)}
                    placeholder="예: A1"
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
                    헤더 끝 셀
                  </label>
                  <input
                    type="text"
                    value={headerEnd}
                    onChange={(e) => setHeaderEnd(e.target.value)}
                    placeholder="예: J2"
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
            </div>

            {/* Options (checkboxes) */}
            <div className="space-y-2.5" style={{ borderTop: "1px solid #F0F1F4", paddingTop: "12px" }}>
              {[
                { label: "모의 테스트 (LLM 미호출)", checked: useMock, onChange: setUseMock },
                { label: "프롬프트 보기", checked: includePrompt, onChange: setIncludePrompt },
                { label: "원본 행 보기", checked: includeRows, onChange: setIncludeRows },
                { label: "디버그 정보", checked: includeDebug, onChange: setIncludeDebug },
              ].map(({ label, checked, onChange }) => (
                <label
                  key={label}
                  className="flex items-center gap-2.5 text-sm cursor-pointer select-none"
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
            disabled={loading || !file}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
            style={{
              backgroundColor: loading || !file ? "#B0B8C1" : "#0064FF",
            }}
            onMouseEnter={(e) => {
              if (!loading && file) e.currentTarget.style.backgroundColor = "#0050CC";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = loading || !file ? "#B0B8C1" : "#0064FF";
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
        <div className="lg:col-span-2">
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
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: "#191F28" }}>
                  생성 결과{" "}
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#8B95A1" }}
                  >
                    ({results.length}건)
                  </span>
                </h2>
              </div>

              {results.map((item, idx) => (
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
                          {item.common["개방 데이터셋명"] ||
                            item.group_key ||
                            `그룹 ${item.row_index}`}
                        </p>
                        {item.common["테이블명(한글)"] && (
                          <p className="text-xs" style={{ color: "#8B95A1" }}>
                            {item.common["테이블명(한글)"]}
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
                      {/* Common Info */}
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

                      {/* Columns */}
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

                      {/* Prompt */}
                      {item.prompt && (
                        <div>
                          <p
                            className="mb-2 text-xs font-semibold"
                            style={{ color: "#8B95A1" }}
                          >
                            프롬프트
                          </p>
                          <pre
                            className="max-h-48 overflow-auto p-3 text-xs leading-relaxed font-mono"
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

                      {/* Raw Rows */}
                      {item.rows && (
                        <div>
                          <p
                            className="mb-2 text-xs font-semibold"
                            style={{ color: "#8B95A1" }}
                          >
                            원본 행 ({item.rows.length}개)
                          </p>
                          <pre
                            className="max-h-48 overflow-auto p-3 text-xs leading-relaxed font-mono"
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

              {/* Debug Info */}
              {debug && (
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: "#FFF5E6",
                    border: "1px solid rgba(255,136,0,0.2)",
                  }}
                >
                  <p
                    className="mb-2 text-xs font-semibold"
                    style={{ color: "#FF8800" }}
                  >
                    디버그 정보
                  </p>
                  <pre
                    className="max-h-48 overflow-auto p-3 text-xs leading-relaxed font-mono"
                    style={{
                      backgroundColor: "#F0F1F4",
                      borderRadius: "10px",
                      color: "#4E5968",
                    }}
                  >
                    {JSON.stringify(debug, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
