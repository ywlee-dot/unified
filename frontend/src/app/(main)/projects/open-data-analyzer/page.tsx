"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sparkles, Upload, FileSpreadsheet, X,
  ChevronDown, ChevronUp, Copy, Check, History,
} from "lucide-react";
import type {
  OpenDataTableRow, OpenDataGroup, OpenDataAnalysisResult, DatasetSummaryResult,
} from "@/lib/types";
import { BranchingPipeline, type PipelineGraph } from "@/components/architecture/BranchingPipeline";
import { api } from "@/lib/api";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import RunHistoryPanel from "@/components/shared/RunHistoryPanel";
import {
  HwpDocumentPreview,
  type HwpDocumentData,
} from "@/components/shared/HwpDocumentPreview";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const PROCESS_PIPELINE: PipelineGraph = {
  rows: [
    [
      { label: "기개방데이터 여부 확인", step: 1 },
      { label: "AI 친화 고가치 데이터 포함 여부 확인", step: 2 },
      { label: "신규/변경/수정 테이블 존재 여부 확인", step: 5 },
      null,
      null,
      { label: "당해년도 개방공유 데이터셋 구성", step: 14 },
      { label: "개방데이터별 키워드 설명, 작성", step: 15 },
      { label: "연도에 따른 개방 이행", step: 17 },
      { label: "AI 친화 고가치 보고서 작성", step: 18 },
    ],
    [
      null,
      { label: "대국민 수요조사", step: 3 },
      { label: "테이블 전체 개방공유 가능 여부확인", step: 6 },
      { label: "데이터셋 후보군 생성", step: 7 },
      { label: "현업부서 개방공유 가능성 검토", step: 11 },
      { label: "연도별 개방 계획 수립", step: 12 },
      { label: "가명처리 또는 합성데이터 처리", step: 16 },
      null,
      null,
    ],
    [
      null,
      { label: "보유데이터 전수 조사", step: 4 },
      { label: "테이블 부분 개방공유 가능 여부 확인", step: 8 },
      null,
      { label: "개방공유 불가 사유 타당성 검토", step: 13 },
      null,
      null,
      null,
      null,
    ],
    [
      null,
      null,
      { label: "테이블 개방 공유 불가", step: 9 },
      null,
      { label: "개방 불가 사유 기재", step: 10 },
      null,
      null,
      null,
      null,
    ],
  ],
  edges: [
    { from: [0, 0], to: [0, 1], label: "Y" },
    { from: [0, 0], to: [1, 1], label: "N", srcPort: "bottom", tgtPort: "left" },
    { from: [1, 1], to: [2, 1] },
    { from: [0, 1], to: [0, 2], label: "Y" },
    { from: [0, 1], to: [1, 1], label: "N" },
    { from: [0, 2], to: [1, 2], label: "Y" },
    { from: [2, 1], to: [1, 2], srcPort: "right", tgtPort: "left" },
    { from: [1, 2], to: [1, 3], label: "Y" },
    { from: [1, 2], to: [2, 2], label: "N" },
    { from: [2, 2], to: [1, 3], label: "Y", srcPort: "right", tgtPort: "left" },
    { from: [2, 2], to: [3, 2], label: "N" },
    { from: [3, 2], to: [3, 4] },
    { from: [1, 3], to: [1, 4] },
    { from: [1, 4], to: [1, 5], label: "Y" },
    { from: [1, 4], to: [2, 4], label: "N" },
    { from: [2, 4], to: [3, 4], label: "Y" },
    { from: [2, 4], to: [1, 3], label: "N", srcPort: "left", tgtPort: "bottom" },
    { from: [0, 2], to: [0, 5] },
    { from: [1, 5], to: [0, 5] },
    { from: [0, 5], to: [0, 6], label: "N" },
    { from: [0, 5], to: [1, 6], label: "Y", srcPort: "right", tgtPort: "left" },
    { from: [0, 6], to: [0, 7] },
    { from: [0, 7], to: [0, 8] },
  ],
  groups: [
    { cells: [[1, 1], [2, 1]], color: "#0064FF", mode: "merge" },
    {
      cells: [
        [1, 2], [1, 3], [1, 4],
        [2, 2], [2, 3], [2, 4],
        [3, 2], [3, 3], [3, 4],
      ],
      color: "#10B981",
      mode: "merge",
    },
    {
      cells: [[0, 6]],
      color: "#7C3AED",
      mode: "merge",
    },
  ],
};

const EXCLUSION_REASON_LABELS: Record<number, string> = {
  1: "법률상 비공개",
  2: "국가안보·외교",
  3: "국민 생명·재산",
  4: "재판·수사",
  5: "감사·검사·인사",
  6: "개인정보",
  7: "영업비밀",
  8: "부동산투기",
  9: "시스템 테이블",
};

const EXCLUSION_REASON_FULL: Record<number, string> = {
  1: "다른 법률에 따라 비공개",
  2: "국가안전보장·국방·외교",
  3: "국민 생명·신체·재산 보호",
  4: "재판·수사·형 집행",
  5: "감사·감독·시험·인사관리",
  6: "개인정보 (성명·주민번호·연락처 등)",
  7: "법인·개인 영업비밀",
  8: "부동산 투기·매점매석 우려",
  9: "시스템 테이블·시스템 내부 컬럼",
};

function formatReasonShort(closed: { reason: string; reason_codes?: number[] }): string {
  const codes = closed.reason_codes ?? [];
  if (codes.length > 0) {
    const labels = codes.map((c) => `${c}.${EXCLUSION_REASON_LABELS[c] ?? "?"}`).join(", ");
    return labels;
  }
  return closed.reason || "";
}

function formatReasonFull(closed: { reason: string; reason_codes?: number[] }): string {
  const codes = closed.reason_codes ?? [];
  if (codes.length > 0) {
    return codes.map((c) => `${c}. ${EXCLUSION_REASON_FULL[c] ?? "?"}`).join("\n");
  }
  return closed.reason || "";
}

function buildVerifyHwpData(result: OpenDataAnalysisResult): HwpDocumentData {
  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  const total = result.total || 1;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  const sections: HwpDocumentData["sections"] = [];

  // 1. 분석 요약 표
  sections.push({
    heading: "분석 요약",
    table: {
      headers: [
        { value: "구분", align: "center" },
        { value: "건수", align: "center" },
        { value: "비율", align: "center" },
      ],
      columnWidths: [50, 25, 25],
      rows: [
        [
          { value: "전체 테이블" },
          { value: result.total.toLocaleString(), align: "right" },
          { value: "100.0%", align: "right" },
        ],
        [
          { value: "전체개방" },
          { value: result.full_open_count.toLocaleString(), align: "right" },
          { value: pct(result.full_open_count), align: "right" },
        ],
        [
          { value: "부분개방" },
          { value: result.partial_count.toLocaleString(), align: "right" },
          { value: pct(result.partial_count), align: "right" },
        ],
        [
          { value: "개방불가" },
          { value: result.not_openable_count.toLocaleString(), align: "right" },
          { value: pct(result.not_openable_count), align: "right" },
        ],
      ],
    },
  });

  // 2. 그룹별 테이블 — 한 컬럼당 한 행으로 전개, 좌측 4개 셀은 rowspan
  type Cell = string | import("@/components/shared/HwpDocumentPreview").HwpTableCell;
  for (const group of result.groups) {
    const rows: Cell[][] = [];
    for (const t of group.tables) {
      const cols: { name: string; reason: string }[] = [
        ...t.open_columns.map((name) => ({ name, reason: "" })),
        ...t.closed_columns.map((c) => ({ name: c.name, reason: formatReasonShort(c) })),
      ];
      const span = Math.max(1, cols.length);

      const firstRow: Cell[] = [
        { value: t.table, rowspan: span },
        {
          value: t.bucket,
          align: "center",
          bold: true,
          bg: t.bucket === "전체개방" ? "#E6F9F3" : "#FFF8E1",
          rowspan: span,
        },
        { value: `${t.open_count}/${t.total_count}`, align: "center", rowspan: span },
        { value: t.dataset_name || "-", rowspan: span },
        { value: cols[0]?.name ?? "-" },
        { value: cols[0]?.reason ?? "" },
      ];
      rows.push(firstRow);

      for (let i = 1; i < cols.length; i++) {
        rows.push([{ value: cols[i].name }, { value: cols[i].reason }]);
      }
    }

    sections.push({
      heading: `[${group.major_area}] ${group.tables.length}개 테이블`,
      table: {
        headers: [
          { value: "테이블명", align: "center" },
          { value: "판정", align: "center" },
          { value: "컬럼", align: "center" },
          { value: "데이터셋명", align: "center" },
          { value: "주요 개방 컬럼", align: "center" },
          { value: "사유", align: "center" },
        ],
        columnWidths: [22, 8, 7, 22, 21, 20],
        rows,
      },
    });
  }

  // 3. 개방 불가 목록 — 동일 구조 (전체 컬럼이 closed라 모두 사유 채워짐)
  if (result.not_openable.length) {
    type Cell2 = string | import("@/components/shared/HwpDocumentPreview").HwpTableCell;
    const rows: Cell2[][] = [];
    for (const t of result.not_openable) {
      const cols: { name: string; reason: string }[] = [
        ...t.open_columns.map((name) => ({ name, reason: "" })),
        ...t.closed_columns.map((c) => ({ name: c.name, reason: formatReasonShort(c) })),
      ];
      const span = Math.max(1, cols.length);

      rows.push([
        { value: t.table, rowspan: span },
        {
          value: "개방불가",
          align: "center",
          bold: true,
          bg: "#FFF0F1",
          rowspan: span,
        },
        { value: `${t.open_count}/${t.total_count}`, align: "center", rowspan: span },
        { value: t.dataset_name || "-", rowspan: span },
        { value: cols[0]?.name ?? "-" },
        { value: cols[0]?.reason ?? "" },
      ]);
      for (let i = 1; i < cols.length; i++) {
        rows.push([{ value: cols[i].name }, { value: cols[i].reason }]);
      }
    }

    sections.push({
      heading: `개방 불가 목록 (${result.not_openable.length}건)`,
      table: {
        headers: [
          { value: "테이블명", align: "center" },
          { value: "판정", align: "center" },
          { value: "컬럼", align: "center" },
          { value: "데이터셋명", align: "center" },
          { value: "주요 개방 컬럼", align: "center" },
          { value: "사유", align: "center" },
        ],
        columnWidths: [22, 8, 7, 22, 21, 20],
        rows,
      },
    });
  }

  return {
    title: "개방데이터 분석 결과",
    subtitle: "컬럼 단위 개방 가능 여부 판단",
    date: dateStr,
    sections,
  };
}

type Tab = "verify" | "summary";
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

export default function OpenDataAnalyzerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("verify");

  return (
    <div className="space-y-6">
      {/* 전체 프로세스 파이프라인 */}
      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold" style={{ color: "#191F28" }}>
            전체 프로세스
          </h2>
          <span className="text-xs" style={{ color: "#8B95A1" }}>
            개방 가능 여부 판단 흐름
          </span>
        </div>
        <BranchingPipeline
          graph={PROCESS_PIPELINE}
          color="#0064FF"
          activeGroups={
            activeTab === "verify"
              ? [{ index: 1, effect: "ants" }]
              : activeTab === "summary"
              ? [{ index: 2, effect: "ants" }]
              : undefined
          }
        />
      </div>

      {/* 탭 네비게이션 */}
      <div
        className="inline-flex gap-1 p-1 rounded-xl"
        style={{ backgroundColor: "#F0F1F4" }}
      >
        <TabButton active={activeTab === "verify"} onClick={() => setActiveTab("verify")}>
          개방가능검증
        </TabButton>
        <TabButton active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>
          설명/키워드 생성
        </TabButton>
      </div>

      {activeTab === "verify" && <VerifyTab />}
      {activeTab === "summary" && <SummaryTab />}
    </div>
  );
}

function TabButton({
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
      className="px-5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
      style={{
        backgroundColor: active ? "#FFFFFF" : "transparent",
        color: active ? "#191F28" : "#8B95A1",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
      }}
    >
      {children}
    </button>
  );
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

/* ------------------------------------------------------------------ */
/* 탭 1 — 개방가능검증                                                  */
/* ------------------------------------------------------------------ */

function VerifyTab() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [result, setResult] = useState<OpenDataAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [viewMode, setViewMode] = useState<ResultViewMode>("default");
  const [showHistory, setShowHistory] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    if (dropped.length > 0) setFiles(dropped);
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setProgress(null);
    stopPolling();
    try {
      const formData = new FormData();
      if (files.length === 0 && !sessionId) throw new Error("파일을 선택해주세요.");
      files.forEach((f) => formData.append("columns_files", f));
      if (sessionId) formData.append("session_id", sessionId);
      formData.append("mock", mockMode.toString());

      const resp = await fetch(`${API_BASE}/projects/open-data-analyzer/stage1`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `분석 시작 실패 (${resp.status})`);
      }
      const { execution_id, session_id: newSessionId } = await resp.json();
      setExecutionId(execution_id);
      setSessionId(newSessionId);
      setViewingHistory(false);

      pollingRef.current = setInterval(async () => {
        try {
          const pResp = await fetch(
            `${API_BASE}/projects/open-data-analyzer/stage1/progress/${execution_id}`,
            { credentials: "include" }
          );
          if (!pResp.ok) return;
          const prog = await pResp.json();
          if (prog.total > 0) setProgress({ done: prog.done, total: prog.total });

          if (prog.status === "succeeded") {
            stopPolling();
            const rResp = await fetch(
              `${API_BASE}/projects/open-data-analyzer/runs/${execution_id}`,
              { credentials: "include" }
            );
            if (!rResp.ok) throw new Error("결과 불러오기 실패");
            const detail = await rResp.json();
            const response = detail.result_data?.response;
            if (!response) throw new Error("결과 데이터가 없습니다.");
            setResult(response as OpenDataAnalysisResult);
            setHistoryRefresh((v) => v + 1);
            setLoading(false);
            setProgress(null);
          } else if (prog.status === "failed") {
            stopPolling();
            setError(prog.error || "분석 실패");
            setLoading(false);
            setProgress(null);
          }
        } catch {
          // transient polling error — keep trying
        }
      }, 1500);
    } catch (err: any) {
      stopPolling();
      setError(err.message || "알 수 없는 오류가 발생했습니다.");
      setLoading(false);
      setProgress(null);
    }
  };

  const loadFromHistory = async (execId: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_BASE}/projects/open-data-analyzer/runs/${execId}`,
        { credentials: "include" }
      );
      if (!resp.ok) throw new Error(`이력 불러오기 실패 (${resp.status})`);
      const detail = await resp.json();
      const response = (detail.result_data as any)?.response;
      if (!response) throw new Error("결과 데이터가 없습니다.");
      setResult(response as OpenDataAnalysisResult);
      setExecutionId(execId);
      setSessionId(null);
      setViewingHistory(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      let blob: Blob;
      let suffix: string;
      if (executionId) {
        const resp = await fetch(
          `${API_BASE}/projects/open-data-analyzer/runs/${executionId}/export`,
          { credentials: "include" }
        );
        if (!resp.ok) throw new Error("내보내기 실패");
        blob = await resp.blob();
        suffix = executionId.slice(0, 8);
      } else if (sessionId) {
        const formData = new FormData();
        formData.append("session_id", sessionId);
        const resp = await fetch(`${API_BASE}/projects/open-data-analyzer/export`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!resp.ok) throw new Error("내보내기 실패");
        blob = await resp.blob();
        suffix = sessionId.slice(0, 8);
      } else {
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `개방데이터분석결과_${suffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    stopPolling();
    setSessionId(null);
    setExecutionId(null);
    setViewingHistory(false);
    setResult(null);
    setFiles([]);
    setError(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canRun = files.length > 0 || !!sessionId;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#191F28" }}>
            개방 가능 여부 판단
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8B95A1" }}>
            엑셀 테이블 정의서를 업로드하면 컬럼 단위로 개방 가능 여부를 분석합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: showHistory ? "#0064FF" : "#8B95A1" }}
          >
            <History className="w-4 h-4" />
            히스토리
          </button>
          <label
            className="flex items-center gap-2 text-sm cursor-pointer select-none"
            style={{ color: "#4E5968" }}
          >
            <button
              role="switch"
              aria-checked={mockMode}
              onClick={() => setMockMode((v) => !v)}
              className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none"
              style={{ backgroundColor: mockMode ? "#0064FF" : "#E8E9ED" }}
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
          {(sessionId || result) && (
            <button
              onClick={reset}
              className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
            >
              새 세션
            </button>
          )}
          {result && (
            <button
              onClick={handleExport}
              disabled={loading}
              className="px-3 py-1.5 text-sm rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: "#00B386", color: "#FFFFFF" }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#009E77"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#00B386"; }}
            >
              엑셀 내보내기
            </button>
          )}
        </div>
      </div>

      {showHistory && (
        <RunHistoryPanel
          projectSlug="open-data-analyzer"
          onSelect={(id) => { setShowHistory(false); loadFromHistory(id); }}
          onClose={() => setShowHistory(false)}
          refreshKey={historyRefresh}
          selectedExecutionId={executionId}
        />
      )}

      {viewingHistory && result && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm"
          style={{
            backgroundColor: "#E8F1FF",
            border: "1px solid rgba(0,100,255,0.2)",
            color: "#0050CC",
          }}
        >
          <span>이전 실행 결과를 보고 있습니다 ({executionId?.slice(0, 8)}...)</span>
          <button
            onClick={reset}
            className="text-xs font-medium underline"
            style={{ color: "#0050CC" }}
          >
            현재 작업으로 돌아가기
          </button>
        </div>
      )}

      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            backgroundColor: "#FFF0F1",
            color: "#F04452",
            border: "1px solid rgba(240,68,82,0.2)",
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left: Upload + Submit */}
        <div className="space-y-4 lg:col-span-1">
          <div
            className="rounded-xl shadow-md p-6"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}
          >
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg p-6 transition-colors"
              style={{
                border: `2px dashed ${files.length > 0 ? "#00B386" : "#E5E8EB"}`,
                backgroundColor: files.length > 0 ? "#E6F9F3" : "#F4F5F8",
              }}
              onMouseEnter={(e) => {
                if (!files.length) {
                  e.currentTarget.style.borderColor = "#0064FF";
                  e.currentTarget.style.backgroundColor = "#E8F1FF";
                }
              }}
              onMouseLeave={(e) => {
                if (!files.length) {
                  e.currentTarget.style.borderColor = "#E5E8EB";
                  e.currentTarget.style.backgroundColor = "#F4F5F8";
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
              />
              <Upload className="mb-2 h-7 w-7" style={{ color: files.length > 0 ? "#00B386" : "#B0B8C1" }} />
              <p className="text-sm" style={{ color: "#4E5968" }}>
                엑셀 파일을 드래그하거나 클릭하여 선택
              </p>
              <p className="text-xs mt-1" style={{ color: "#8B95A1" }}>
                .xlsx, .xls (다중 가능)
              </p>
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-1">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md"
                    style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0" style={{ color: "#8B95A1" }} />
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0" style={{ color: "#8B95A1" }}>({(f.size / 1024).toFixed(1)}KB)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading || !canRun}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
            style={{ backgroundColor: loading || !canRun ? "#B0B8C1" : "#0064FF" }}
            onMouseEnter={(e) => { if (!loading && canRun) e.currentTarget.style.backgroundColor = "#0050CC"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = loading || !canRun ? "#B0B8C1" : "#0064FF"; }}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                분석 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                분석 실행
              </>
            )}
          </button>

          {(loading || result) && <FormatGuide content={VERIFY_GUIDE} compact />}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {!result && !loading && <FormatGuide content={VERIFY_GUIDE} />}

          {loading && !result && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-sm" style={{ color: "#8B95A1" }}>
                  컬럼 단위로 개방 가능 여부를 분석하고 있습니다...
                </p>
                {progress && progress.total > 0 && (
                  <p className="mt-1 text-xs" style={{ color: "#B0B8C1" }}>
                    ({Math.round((progress.done / progress.total) * 100)}%)
                  </p>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                  <StatBadge label="전체" value={result.total} bg="#F4F5F8" color="#191F28" />
                  <StatBadge label="전체개방" value={result.full_open_count} bg="#E6F9F3" color="#00B386" />
                  {result.partial_count > 0 && (
                    <StatBadge label="부분개방" value={result.partial_count} bg="#FFF8E1" color="#B78103" />
                  )}
                  <StatBadge label="개방불가" value={result.not_openable_count} bg="#FFF0F1" color="#F04452" />
                </div>
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
              </div>

              {viewMode === "hwp" && (
                <HwpDocumentPreview data={buildVerifyHwpData(result)} />
              )}

              {viewMode === "default" && result.groups.length > 0 && (
                <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
                  <div className="px-6 py-4 border-b" style={{ borderColor: "#E5E8EB" }}>
                    <h2 className="text-base font-semibold" style={{ color: "#191F28" }}>
                      개방 가능 데이터셋
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "#8B95A1" }}>
                      전체개방 {result.full_open_count}건 · 부분개방 {result.partial_count}건
                    </p>
                  </div>
                  <div className="divide-y" style={{ borderColor: "#F0F1F4" }}>
                    {result.groups.map((group) => (
                      <GroupSection key={group.major_area} group={group} />
                    ))}
                  </div>
                </div>
              )}

              {viewMode === "default" && result.not_openable.length > 0 && (
                <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
                  <div className="px-6 py-4 border-b" style={{ borderColor: "#E5E8EB" }}>
                    <h2 className="text-base font-semibold" style={{ color: "#191F28" }}>
                      개방 불가 목록
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "#8B95A1" }}>
                      {result.not_openable_count}건
                    </p>
                  </div>
                  <div className="space-y-3 px-6 py-4">
                    {result.not_openable.map((row) => (
                      <TableDetailRow key={row.key} row={{ ...row, bucket: "개방불가" }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {sessionId && (
        <div className="text-xs" style={{ color: "#B0B8C1" }}>
          세션: {sessionId.slice(0, 12)}...
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 탭 2 — 설명/키워드 생성                                              */
/* ------------------------------------------------------------------ */

function SummaryTab() {
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
  const [viewingHistory, setViewingHistory] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState<ResultViewMode>("default");

  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (!file) { setError("파일을 선택해주세요."); return; }
    if (!orgName.trim()) { setError("기관명을 입력해주세요."); return; }

    setLoading(true);
    setError(null);
    setResults([]);
    setProgress(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("org_name", orgName);
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
          setViewingHistory(false);
          setHistoryRefresh((v) => v + 1);
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

  const loadFromHistory = async (execId: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_BASE}/projects/dataset-summary/runs/${execId}`,
        { credentials: "include" }
      );
      if (!resp.ok) throw new Error(`이력 불러오기 실패 (${resp.status})`);
      const detail = await resp.json();
      const response = (detail.result_data as any)?.response;
      if (!response) throw new Error("결과 데이터가 없습니다.");
      setResults(response.results || []);
      setExecutionId(execId);
      setViewingHistory(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이력 불러오기 실패");
    } finally {
      setLoading(false);
    }
  };

  const resetView = () => {
    setResults([]);
    setExecutionId(null);
    setViewingHistory(false);
    setError(null);
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
      if (next.has(idx)) next.delete(idx); else next.add(idx);
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

  const focusStyle = { boxShadow: "0 0 0 2px rgba(0,100,255,0.2)" };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#191F28" }}>
            데이터셋 설명/키워드 자동생성
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#8B95A1" }}>
            데이터셋 정의서(Excel/CSV)를 업로드하면 LLM이 키워드 8개와 설명문을 자동 생성합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: showHistory ? "#0064FF" : "#8B95A1" }}
          >
            <History className="w-4 h-4" />
            히스토리
          </button>
          <label
            className="flex items-center gap-2 text-sm cursor-pointer select-none"
            style={{ color: "#4E5968" }}
          >
            <button
              role="switch"
              aria-checked={useMock}
              onClick={() => setUseMock((v) => !v)}
              className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none"
              style={{ backgroundColor: useMock ? "#0064FF" : "#E8E9ED" }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                style={{
                  transform: useMock ? "translateX(18px)" : "translateX(2px)",
                  marginTop: "2px",
                }}
              />
            </button>
            Mock 모드
          </label>
        </div>
      </div>

      {showHistory && (
        <RunHistoryPanel
          projectSlug="dataset-summary"
          onSelect={(id) => { setShowHistory(false); loadFromHistory(id); }}
          onClose={() => setShowHistory(false)}
          refreshKey={historyRefresh}
          selectedExecutionId={executionId}
        />
      )}

      {viewingHistory && results.length > 0 && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm"
          style={{
            backgroundColor: "#E8F1FF",
            border: "1px solid rgba(0,100,255,0.2)",
            color: "#0050CC",
          }}
        >
          <span>이전 실행 결과를 보고 있습니다 ({executionId?.slice(0, 8)}...)</span>
          <button
            onClick={resetView}
            className="text-xs font-medium underline"
            style={{ color: "#0050CC" }}
          >
            현재 작업으로 돌아가기
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left: Upload + Settings */}
        <div className="space-y-4 lg:col-span-1">
          <div
            className="rounded-xl shadow-md p-6 space-y-4"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}
          >
            {/* File Upload */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
                파일 업로드
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg p-6 transition-colors"
                style={{
                  border: `2px dashed ${dragOver ? "#0064FF" : file ? "#00B386" : "#E5E8EB"}`,
                  backgroundColor: dragOver ? "#E8F1FF" : file ? "#E6F9F3" : "#F4F5F8",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                {file ? (
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" style={{ color: "#00B386" }} />
                    <span className="text-sm font-medium truncate max-w-[160px]" style={{ color: "#00B386" }}>
                      {file.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
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
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
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
                  onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2.5" style={{ borderTop: "1px solid #F0F1F4", paddingTop: "12px" }}>
              {([
                { label: "프롬프트 보기", checked: includePrompt, onChange: setIncludePrompt },
                { label: "원본 행 보기", checked: includeRows, onChange: setIncludeRows },
              ] as const).map(({ label, checked, onChange }) => (
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
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
            style={{ backgroundColor: loading || !file || !orgName.trim() ? "#B0B8C1" : "#0064FF" }}
            onMouseEnter={(e) => { if (!loading && file && orgName.trim()) e.currentTarget.style.backgroundColor = "#0050CC"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = loading || !file || !orgName.trim() ? "#B0B8C1" : "#0064FF"; }}
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
              style={{ backgroundColor: "#FFF0F1", color: "#F04452", border: "1px solid rgba(240,68,82,0.2)" }}
            >
              {error}
            </div>
          )}

          {(loading || results.length > 0) && <FormatGuide content={SUMMARY_GUIDE} compact />}
        </div>

        {/* Right: Results */}
        <div className="min-w-0 lg:col-span-2">
          {results.length === 0 && !loading && <FormatGuide content={SUMMARY_GUIDE} />}

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
                  <span className="text-sm font-medium" style={{ color: "#8B95A1" }}>
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
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}
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
                        style={{ backgroundColor: "#E8F1FF", color: "#0064FF" }}
                      >
                        {item.row_index}
                      </span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#191F28" }}>
                          {item.common["데이터셋명"] || item.group_key || `그룹 ${item.row_index}`}
                        </p>
                        {item.common["테이블명"] && (
                          <p className="text-xs" style={{ color: "#8B95A1" }}>
                            {item.common["테이블명"]}
                          </p>
                        )}
                      </div>
                    </div>
                    {expandedCards.has(idx)
                      ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "#8B95A1" }} />
                      : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#8B95A1" }} />}
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
                        style={{ backgroundColor: "#E8F1FF", color: "#0064FF", borderRadius: "6px" }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed" style={{ color: "#4E5968" }}>
                        {item.description}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(item.description, idx); }}
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
                        {copiedIdx === idx
                          ? <Check className="h-4 w-4" style={{ color: "#00B386" }} />
                          : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedCards.has(idx) && (
                    <div
                      className="space-y-4 px-4 py-4"
                      style={{ borderTop: "1px solid #F0F1F4", backgroundColor: "#F4F5F8" }}
                    >
                      {Object.keys(item.common).length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold" style={{ color: "#8B95A1" }}>공통 정보</p>
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
                          <p className="mb-2 text-xs font-semibold" style={{ color: "#8B95A1" }}>
                            컬럼 목록 ({item.columns.length}개)
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.columns.map((col, colIdx) => (
                              <span
                                key={colIdx}
                                className="inline-flex px-1.5 py-0.5 text-xs"
                                style={{ backgroundColor: "#E8E9ED", color: "#4E5968", borderRadius: "6px" }}
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.prompt && (
                        <div>
                          <p className="mb-2 text-xs font-semibold" style={{ color: "#8B95A1" }}>프롬프트</p>
                          <pre
                            className="max-h-48 overflow-auto whitespace-pre-wrap break-all p-3 text-xs leading-relaxed font-mono"
                            style={{ backgroundColor: "#F0F1F4", borderRadius: "10px", color: "#4E5968" }}
                          >
                            {item.prompt}
                          </pre>
                        </div>
                      )}
                      {item.rows && (
                        <div>
                          <p className="mb-2 text-xs font-semibold" style={{ color: "#8B95A1" }}>
                            원본 행 ({item.rows.length}개)
                          </p>
                          <pre
                            className="max-h-48 overflow-auto whitespace-pre-wrap break-all p-3 text-xs leading-relaxed font-mono"
                            style={{ backgroundColor: "#F0F1F4", borderRadius: "10px", color: "#4E5968" }}
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

/* ------------------------------------------------------------------ */
/* 공용 컴포넌트                                                         */
/* ------------------------------------------------------------------ */

function StatBadge({ label, value, bg, color }: { label: string; value: number; bg: string; color: string }) {
  return (
    <div className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: bg }}>
      <span style={{ color }}>{label} </span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

function GroupSection({ group }: { group: OpenDataGroup }) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ backgroundColor: "#E8F1FF", color: "#0064FF" }}
        >
          {group.major_area}
        </span>
        <span className="text-xs" style={{ color: "#8B95A1" }}>{group.tables.length}개 테이블</span>
      </div>
      <div className="space-y-3">
        {group.tables.map((row) => (
          <TableDetailRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}

function bucketColors(bucket: string): { bg: string; color: string } {
  if (bucket === "전체개방") return { bg: "#E6F9F3", color: "#00B386" };
  if (bucket === "부분개방") return { bg: "#FFF8E1", color: "#B78103" };
  return { bg: "#FFF0F1", color: "#F04452" }; // 불가능 / 개방불가
}

function TableDetailRow({ row }: { row: OpenDataTableRow }) {
  const bs = bucketColors(row.bucket);
  const allColumns: { name: string; reason: string; reasonFull: string }[] = [
    ...row.open_columns.map((name) => ({ name, reason: "", reasonFull: "" })),
    ...row.closed_columns.map((c) => ({
      name: c.name,
      reason: formatReasonShort(c),
      reasonFull: formatReasonFull(c),
    })),
  ];

  return (
    <div
      className="overflow-hidden rounded-lg"
      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}
    >
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3"
        style={{ backgroundColor: "#F8F9FB", borderBottom: "1px solid #E5E8EB" }}
      >
        <span className="text-sm font-semibold" style={{ color: "#191F28" }}>
          {row.table}
        </span>
        <span
          className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: bs.bg, color: bs.color }}
        >
          {row.bucket}
        </span>
        <span className="text-xs shrink-0" style={{ color: "#8B95A1" }}>
          {row.open_count}/{row.total_count}
        </span>
        {row.dataset_name && (
          <span className="text-xs truncate" style={{ color: "#4E5968" }}>
            · {row.dataset_name}
          </span>
        )}
      </div>
      {allColumns.length > 0 && (
        <div>
          {allColumns.map((col, i) => {
            const isClosed = !!col.reason;
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2 text-xs"
                style={{
                  borderTop: i > 0 ? "1px solid #F0F1F4" : "none",
                  backgroundColor: isClosed ? "#FFFAFA" : "#FFFFFF",
                }}
              >
                <span
                  className="flex-1 truncate"
                  style={{ color: isClosed ? "#F04452" : "#191F28" }}
                >
                  {col.name}
                </span>
                {isClosed && (
                  <span
                    className="shrink-0 max-w-[45%] truncate"
                    style={{ color: "#F04452" }}
                    title={col.reasonFull || col.reason}
                  >
                    {col.reason}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type GuideContent = {
  formats: string;
  fields: { label: string; values: string[] }[];
  inputs?: string[];
  output: string;
  notes?: string[];
};

const VERIFY_GUIDE: GuideContent = {
  formats: ".xlsx, .xls (다중 업로드 가능)",
  fields: [
    { label: "테이블명", values: ["한글 테이블명", "영문 테이블명"] },
    { label: "컬럼명", values: ["한글 컬럼명", "영문 컬럼명"] },
  ],
  output: "컬럼별 개방 가능 여부 + 주제분류 + 데이터셋명 제안",
  notes: ["같은 테이블이 여러 파일에 있으면 자동 병합됩니다"],
};

const SUMMARY_GUIDE: GuideContent = {
  formats: ".xlsx, .csv",
  fields: [
    { label: "필수 헤더", values: ["대분류", "소분류", "데이터셋명", "테이블명", "컬럼명"] },
  ],
  inputs: ["기관명"],
  output: "데이터셋별 키워드 8개 + 한글 설명문",
};

function FormatGuide({
  content,
  compact = false,
}: {
  content: GuideContent;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className="rounded-lg p-3.5 text-xs space-y-2"
        style={{ backgroundColor: "#F4F5F8", border: "1px solid #E5E8EB" }}
      >
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="h-3.5 w-3.5" style={{ color: "#0064FF" }} />
          <p className="font-semibold" style={{ color: "#191F28" }}>입력 양식</p>
        </div>
        <div className="space-y-1" style={{ color: "#4E5968" }}>
          <p>
            <span style={{ color: "#8B95A1" }}>형식: </span>
            {content.formats}
          </p>
          <div>
            <p style={{ color: "#8B95A1" }}>필수 컬럼:</p>
            <ul className="ml-1 mt-0.5 space-y-0.5">
              {content.fields.map((f, i) => (
                <li key={i}>· {f.label}: {f.values.join(" / ")}</li>
              ))}
            </ul>
          </div>
          {content.inputs && content.inputs.length > 0 && (
            <p>
              <span style={{ color: "#8B95A1" }}>필수 입력: </span>
              {content.inputs.join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[256px] flex-col gap-4 rounded-xl p-6"
      style={{ border: "2px dashed #E5E8EB", backgroundColor: "#F4F5F8" }}
    >
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5" style={{ color: "#0064FF" }} />
        <p className="text-sm font-semibold" style={{ color: "#191F28" }}>
          입력 파일 양식 안내
        </p>
      </div>
      <div className="space-y-4 text-sm" style={{ color: "#4E5968" }}>
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "#8B95A1" }}>
            지원 형식
          </p>
          <p>{content.formats}</p>
        </div>
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "#8B95A1" }}>
            필수 컬럼
          </p>
          <ul className="space-y-2">
            {content.fields.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <span className="font-medium" style={{ color: "#191F28" }}>
                  {f.label}
                </span>
                <span style={{ color: "#8B95A1" }}>·</span>
                <span className="flex flex-wrap gap-1.5">
                  {f.values.map((v, vi) => (
                    <code
                      key={vi}
                      className="px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E8EB",
                        borderRadius: "6px",
                        color: "#4E5968",
                      }}
                    >
                      {v}
                    </code>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {content.inputs && content.inputs.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: "#8B95A1" }}>
              필수 입력
            </p>
            <p>{content.inputs.join(", ")}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "#8B95A1" }}>
            분석 결과
          </p>
          <p>{content.output}</p>
        </div>
        {content.notes && content.notes.length > 0 && (
          <div className="pt-3" style={{ borderTop: "1px solid #E5E8EB" }}>
            {content.notes.map((n, i) => (
              <p key={i} className="text-xs" style={{ color: "#8B95A1" }}>
                · {n}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

