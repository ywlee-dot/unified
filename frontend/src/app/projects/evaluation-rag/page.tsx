"use client";

import { useState } from "react";
import {
  ClipboardCheck,
  FileUp,
  History,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  BookOpen,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface ImprovementItem {
  category: string;
  issue: string;
  recommendation: string;
  priority: string;
}

interface EvaluationItemScore {
  item_id: string;
  item_name: string;
  category: string;
  score: number;
  max_score: number;
  reasoning: string;
  issues: string[];
  improvements: string[];
}

interface EvaluationResult {
  id: string;
  summary: string;
  score: number;
  issues: string[];
  improvements: ImprovementItem[];
  input_data: string;
  query: string;
  context: string;
  category: string | null;
  created_at: string;
  total_score: number | null;
  max_possible_score: number | null;
  item_scores: EvaluationItemScore[];
}

interface EvaluationListResponse {
  evaluations: EvaluationResult[];
  total: number;
  page: number;
  page_size: number;
}

interface CriteriaCategory {
  category_en: string;
  category_ko: string;
  description: string;
  items: {
    item_id: string;
    item_name: string;
    description: string;
    scoring_criteria: string;
    max_score: number;
  }[];
}

interface CriteriaResponse {
  categories: CriteriaCategory[];
  total_items: number;
  pinecone_namespace: string;
}

const CATEGORIES = [
  { value: "", label: "자동 감지" },
  { value: "quality", label: "품질" },
  { value: "openness", label: "개방·활용" },
  { value: "analysis", label: "분석·활용" },
  { value: "sharing", label: "공유" },
  { value: "management", label: "관리체계" },
];

function ScoreCircle({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? "#22c55e"
      : score >= 60
        ? "#eab308"
        : score >= 40
          ? "#f97316"
          : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="transition-all duration-700"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className="text-2xl font-bold"
          fill={color}
        >
          {score}
        </text>
      </svg>
      <span className="mt-1 text-sm text-slate-500">/ 100</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority] || "bg-slate-100 text-slate-700"}`}
    >
      {priority}
    </span>
  );
}

function ItemScoreBar({ item }: { item: EvaluationItemScore }) {
  const percentage = (item.score / item.max_score) * 100;
  const color = item.score >= 8 ? "#22c55e" : item.score >= 5 ? "#eab308" : "#ef4444";
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">{item.item_name}</span>
            <span className="text-xs text-slate-400">{item.item_id}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-sm font-bold" style={{ color }}>
              {item.score}/{item.max_score}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-3 text-slate-400 hover:text-slate-600"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {item.reasoning && (
            <p className="text-sm text-slate-600">
              <span className="font-medium">채점 근거:</span> {item.reasoning}
            </p>
          )}
          {item.issues.length > 0 && (
            <div>
              <span className="text-xs font-medium text-amber-600">문제점:</span>
              <ul className="mt-1 space-y-1">
                {item.issues.map((issue, i) => (
                  <li key={i} className="text-xs text-slate-500">• {issue}</li>
                ))}
              </ul>
            </div>
          )}
          {item.improvements.length > 0 && (
            <div>
              <span className="text-xs font-medium text-emerald-600">개선사항:</span>
              <ul className="mt-1 space-y-1">
                {item.improvements.map((imp, i) => (
                  <li key={i} className="text-xs text-slate-500">• {imp}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultView({ result }: { result: EvaluationResult }) {
  const hasItemScores = result.item_scores && result.item_scores.length > 0;

  if (hasItemScores) {
    const totalScore = result.total_score!;
    const maxPossible = result.max_possible_score!;
    const avgPer10 = totalScore / result.item_scores.length;
    const color =
      avgPer10 >= 8 ? "#22c55e" : avgPer10 >= 5 ? "#eab308" : "#ef4444";

    return (
      <div className="space-y-6">
        <div className="flex items-start gap-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold" style={{ color }}>
              {totalScore}
            </span>
            <span className="text-sm text-slate-400">/ {maxPossible}</span>
            <span className="mt-1 text-xs text-slate-400">
              (평균 {avgPer10.toFixed(1)}/10)
            </span>
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-slate-800">
              평가 요약
            </h3>
            <p className="text-slate-600">{result.summary}</p>
            {result.category && (
              <span className="mt-2 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                {result.category}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-800">
            항목별 평가 결과 ({result.item_scores.length}개 항목)
          </h3>
          {result.item_scores.map((item) => (
            <ItemScoreBar key={item.item_id} item={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6 rounded-lg border border-slate-200 bg-white p-6">
        <ScoreCircle score={result.score} />
        <div className="flex-1">
          <h3 className="mb-2 text-lg font-semibold text-slate-800">
            평가 요약
          </h3>
          <p className="text-slate-600">{result.summary}</p>
          {result.category && (
            <span className="mt-2 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
              {result.category}
            </span>
          )}
        </div>
      </div>

      {result.issues.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-3 text-lg font-semibold text-slate-800">
            <AlertCircle className="mr-2 inline h-5 w-5 text-amber-500" />
            발견된 문제점
          </h3>
          <ul className="space-y-2">
            {result.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-600">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.improvements.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-3 text-lg font-semibold text-slate-800">
            <CheckCircle2 className="mr-2 inline h-5 w-5 text-emerald-500" />
            개선사항
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 pr-4">카테고리</th>
                  <th className="pb-2 pr-4">문제점</th>
                  <th className="pb-2 pr-4">권고사항</th>
                  <th className="pb-2">우선순위</th>
                </tr>
              </thead>
              <tbody>
                {result.improvements.map((imp, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium text-slate-700">
                      {imp.category}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{imp.issue}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      {imp.recommendation}
                    </td>
                    <td className="py-3">
                      <PriorityBadge priority={imp.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvaluationRagPage() {
  const [activeTab, setActiveTab] = useState<"text" | "file" | "history" | "criteria">(
    "text"
  );

  // Text evaluation state
  const [inputData, setInputData] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  // File evaluation state
  const [file, setFile] = useState<File | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [fileCategory, setFileCategory] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileResult, setFileResult] = useState<EvaluationResult | null>(null);

  // History state
  const [history, setHistory] = useState<EvaluationResult[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pageSize = 10;

  // Criteria state
  const [criteria, setCriteria] = useState<CriteriaCategory[]>([]);
  const [criteriaTotal, setCriteriaTotal] = useState(0);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [criteriaFilter, setCriteriaFilter] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const handleTextEvaluate = async () => {
    if (!inputData.trim() || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/projects/evaluation-rag/evaluate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input_data: inputData,
            query,
            category: category || null,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `오류 ${res.status}`);
      }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleFileEvaluate = async () => {
    if (!file || !fileQuery.trim()) return;
    setFileLoading(true);
    setFileError(null);
    setFileResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("query", fileQuery);
      if (fileCategory) formData.append("category", fileCategory);

      const res = await fetch(
        `${API_BASE}/projects/evaluation-rag/evaluate-file`,
        { method: "POST", body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `오류 ${res.status}`);
      }
      setFileResult(await res.json());
    } catch (e: unknown) {
      setFileError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setFileLoading(false);
    }
  };

  const loadHistory = async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/projects/evaluation-rag/evaluations?page=${page}&page_size=${pageSize}`
      );
      if (!res.ok) throw new Error("이력 로딩 실패");
      const data: EvaluationListResponse = await res.json();
      setHistory(data.evaluations);
      setHistoryTotal(data.total);
      setHistoryPage(page);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadCriteria = async (category?: string) => {
    setCriteriaLoading(true);
    try {
      const url = category
        ? `${API_BASE}/projects/evaluation-rag/criteria?category=${category}`
        : `${API_BASE}/projects/evaluation-rag/criteria`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("기준표 로딩 실패");
      const data: CriteriaResponse = await res.json();
      setCriteria(data.categories);
      setCriteriaTotal(data.total_items);
    } catch {
      setCriteria([]);
    } finally {
      setCriteriaLoading(false);
    }
  };

  const tabs = [
    { key: "text" as const, label: "텍스트 평가", icon: ClipboardCheck },
    { key: "file" as const, label: "파일 평가", icon: FileUp },
    { key: "history" as const, label: "평가 이력", icon: History },
    { key: "criteria" as const, label: "평가 기준표", icon: BookOpen },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">평가편람</h1>
        <p className="mt-1 text-sm text-slate-500">
          RAG와 Gemini를 활용한 공공데이터 평가편람 기반 자동 평가
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "history" && history.length === 0) loadHistory(1);
              if (tab.key === "criteria" && criteria.length === 0) loadCriteria();
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text Evaluation */}
      {activeTab === "text" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  평가 대상 데이터
                </label>
                <textarea
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="평가할 공공데이터의 내용을 입력하세요..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  평가 질의
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="예: 공공데이터 품질 평가"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  카테고리
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleTextEvaluate}
                disabled={loading || !inputData.trim() || !query.trim()}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "평가 중..." : "평가 실행"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
          {result && <ResultView result={result} />}
        </div>
      )}

      {/* File Evaluation */}
      {activeTab === "file" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  파일 업로드
                </label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-8 transition-colors hover:border-violet-400 hover:bg-violet-50"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) setFile(f);
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept =
                      ".pdf,.txt,.xlsx,.xls,.hwp,.hwpx,.docx";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) setFile(f);
                    };
                    input.click();
                  }}
                >
                  <FileUp className="mb-2 h-8 w-8 text-slate-400" />
                  {file ? (
                    <span className="text-sm font-medium text-violet-600">
                      {file.name}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500">
                        파일을 드래그하거나 클릭하여 업로드
                      </span>
                      <span className="mt-1 text-xs text-slate-400">
                        PDF, TXT, XLSX, HWP, HWPX, DOCX
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  평가 질의
                </label>
                <input
                  type="text"
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="예: 공공데이터 품질 평가"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  카테고리
                </label>
                <select
                  value={fileCategory}
                  onChange={(e) => setFileCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleFileEvaluate}
                disabled={fileLoading || !file || !fileQuery.trim()}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fileLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {fileLoading ? "평가 중..." : "파일 평가 실행"}
              </button>
            </div>
          </div>

          {fileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {fileError}
            </div>
          )}
          {fileResult && <ResultView result={fileResult} />}
        </div>
      )}

      {/* Criteria */}
      {activeTab === "criteria" && (
        <div className="space-y-4">
          {/* Header with total count and category filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">총 {criteriaTotal}개 평가항목</span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-600">v2</span>
            </div>
            <select
              value={criteriaFilter}
              onChange={(e) => { setCriteriaFilter(e.target.value); loadCriteria(e.target.value || undefined); }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">전체 카테고리</option>
              {CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {criteriaLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
          ) : criteria.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center text-slate-500">평가 기준표가 없습니다.</div>
          ) : (
            <div className="space-y-4">
              {criteria.map((cat) => (
                <div key={cat.category_en} className="rounded-lg border border-slate-200 bg-white">
                  {/* Category header */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{cat.category_ko}</h3>
                      <p className="text-sm text-slate-500">{cat.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                      {cat.items.length}개 항목
                    </span>
                  </div>
                  {/* Items */}
                  <div className="divide-y divide-slate-100">
                    {cat.items.map((item) => {
                      const isExpanded = expandedItems.has(item.item_id);
                      return (
                        <div key={item.item_id} className="px-6 py-4">
                          <div
                            className="flex cursor-pointer items-center justify-between"
                            onClick={() => {
                              const next = new Set(expandedItems);
                              isExpanded ? next.delete(item.item_id) : next.add(item.item_id);
                              setExpandedItems(next);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-mono text-violet-600">{item.item_id}</span>
                              <span className="font-medium text-slate-700">{item.item_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-400">{item.max_score}점 만점</span>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-4">
                              <p className="text-sm text-slate-600">{item.description}</p>
                              <div>
                                <span className="text-xs font-semibold text-slate-500">채점 기준:</span>
                                <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{item.scoring_criteria}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
              평가 이력이 없습니다.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="px-4 py-3">날짜</th>
                      <th className="px-4 py-3">질의</th>
                      <th className="px-4 py-3">카테고리</th>
                      <th className="px-4 py-3">점수</th>
                      <th className="px-4 py-3">요약</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {new Date(item.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">
                          {item.query}
                        </td>
                        <td className="px-4 py-3">
                          {item.category ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                              {item.category}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {item.item_scores?.length > 0 ? (
                            <span className="text-slate-700">
                              {item.total_score}/{item.max_possible_score}
                            </span>
                          ) : (
                            <span
                              className={
                                item.score >= 80
                                  ? "text-green-600"
                                  : item.score >= 60
                                    ? "text-yellow-600"
                                    : "text-red-600"
                              }
                            >
                              {item.score}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[300px] truncate px-4 py-3 text-slate-600">
                          {item.summary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  전체 {historyTotal}건
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadHistory(historyPage - 1)}
                    disabled={historyPage <= 1}
                    className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="flex items-center px-3 text-sm text-slate-600">
                    {historyPage} / {Math.max(1, Math.ceil(historyTotal / pageSize))}
                  </span>
                  <button
                    onClick={() => loadHistory(historyPage + 1)}
                    disabled={historyPage >= Math.ceil(historyTotal / pageSize)}
                    className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
