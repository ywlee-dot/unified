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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          데이터셋 설명/키워드 자동생성
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          데이터셋 정의서(Excel/CSV)를 업로드하면 LLM이 키워드 8개와 설명문을
          자동 생성합니다
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Upload + Settings */}
        <div className="space-y-4 lg:col-span-1">
          {/* File Upload */}
          <div
            ref={dropRef}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver
                ? "border-violet-400 bg-violet-50"
                : file
                  ? "border-green-300 bg-green-50"
                  : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
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
                <FileSpreadsheet className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  {file.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="ml-1 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  파일을 드래그하거나 클릭하여 선택
                </p>
                <p className="mt-1 text-xs text-gray-400">.xlsx, .csv</p>
              </>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700">설정</h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                기관명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="예: 한국토지주택공사"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                시트명 (선택)
              </label>
              <input
                type="text"
                value={sheet}
                onChange={(e) => setSheet(e.target.value)}
                placeholder="기본: 첫 번째 시트"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                그룹 키 컬럼 (선택)
              </label>
              <input
                type="text"
                value={groupKey}
                onChange={(e) => setGroupKey(e.target.value)}
                placeholder="자동 감지"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  헤더 시작 셀
                </label>
                <input
                  type="text"
                  value={headerStart}
                  onChange={(e) => setHeaderStart(e.target.value)}
                  placeholder="예: A1"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  헤더 끝 셀
                </label>
                <input
                  type="text"
                  value={headerEnd}
                  onChange={(e) => setHeaderEnd(e.target.value)}
                  placeholder="예: J2"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={useMock}
                  onChange={(e) => setUseMock(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                모의 테스트 (LLM 미호출)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={includePrompt}
                  onChange={(e) => setIncludePrompt(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                프롬프트 보기
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={includeRows}
                  onChange={(e) => setIncludeRows(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                원본 행 보기
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={includeDebug}
                  onChange={(e) => setIncludeDebug(e.target.checked)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                디버그 정보
              </label>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !file}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
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
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {results.length === 0 && !loading && (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <Sparkles className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">
                파일을 업로드하고 생성하기를 눌러주세요
              </p>
            </div>
          )}

          {loading && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-sm text-gray-500">
                  LLM이 설명문과 키워드를 생성하고 있습니다...
                </p>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  생성 결과 ({results.length}건)
                </h2>
              </div>

              {results.map((item, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                >
                  {/* Card Header */}
                  <div
                    className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50"
                    onClick={() => toggleCard(idx)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                        {item.row_index}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {item.common["개방 데이터셋명"] ||
                            item.group_key ||
                            `그룹 ${item.row_index}`}
                        </p>
                        {item.common["테이블명(한글)"] && (
                          <p className="text-xs text-gray-500">
                            {item.common["테이블명(한글)"]}
                          </p>
                        )}
                      </div>
                    </div>
                    {expandedCards.has(idx) ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-4 py-3">
                    {item.keywords.map((kw, kwIdx) => (
                      <span
                        key={kwIdx}
                        className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed text-gray-700">
                        {item.description}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(item.description, idx);
                        }}
                        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="설명문 복사"
                      >
                        {copiedIdx === idx ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedCards.has(idx) && (
                    <div className="space-y-3 border-t border-gray-100 bg-gray-50 px-4 py-3">
                      {/* Common Info */}
                      {Object.keys(item.common).length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-gray-500">
                            공통 정보
                          </p>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(item.common).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-gray-400">{k}: </span>
                                <span className="text-gray-700">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Columns */}
                      {item.columns.length > 0 && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-gray-500">
                            컬럼 목록 ({item.columns.length}개)
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.columns.map((col, colIdx) => (
                              <span
                                key={colIdx}
                                className="inline-flex rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600"
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
                          <p className="mb-1 text-xs font-semibold text-gray-500">
                            프롬프트
                          </p>
                          <pre className="max-h-48 overflow-auto rounded bg-gray-800 p-3 text-xs leading-relaxed text-gray-200">
                            {item.prompt}
                          </pre>
                        </div>
                      )}

                      {/* Raw Rows */}
                      {item.rows && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-gray-500">
                            원본 행 ({item.rows.length}개)
                          </p>
                          <pre className="max-h-48 overflow-auto rounded bg-gray-800 p-3 text-xs leading-relaxed text-gray-200">
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
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-2 text-xs font-semibold text-amber-700">
                    디버그 정보
                  </p>
                  <pre className="max-h-48 overflow-auto rounded bg-gray-800 p-3 text-xs leading-relaxed text-gray-200">
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
