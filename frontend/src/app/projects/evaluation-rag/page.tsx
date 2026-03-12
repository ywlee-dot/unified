"use client";

import { useCallback, useEffect, useState } from "react";
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

const API_BASE = "/api";

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

interface CriteriaItem {
  item_id: string;
  item_name: string;
  description: string;
  scoring_criteria: string;
  max_score: number;
  method?: string;
}

interface CriteriaCategory {
  category_en: string;
  category_ko: string;
  evaluation_type?: string;
  area_score?: number;
  description: string;
  items: CriteriaItem[];
}

interface CriteriaResponse {
  categories: CriteriaCategory[];
  total_items: number;
  pinecone_namespace: string;
}

const EVALUATION_TYPES = [
  { value: "", label: "전체 (공공데이터 + 데이터기반행정)" },
  { value: "public_data", label: "공공데이터 제공 평가 (100점)" },
  { value: "data_admin", label: "데이터기반행정 평가 (100점)" },
];

const CATEGORIES: Record<string, { value: string; label: string; evalType: string }[]> = {
  "": [
    { value: "", label: "자동 감지", evalType: "" },
    { value: "openness", label: "개방·활용 (48점)", evalType: "public_data" },
    { value: "quality", label: "품질 (45점)", evalType: "public_data" },
    { value: "management_pub", label: "관리체계-공공데이터 (7점)", evalType: "public_data" },
    { value: "analysis", label: "분석·활용 (50점)", evalType: "data_admin" },
    { value: "sharing", label: "공유 (45점)", evalType: "data_admin" },
    { value: "management_dba", label: "관리체계-데이터기반행정 (5점)", evalType: "data_admin" },
  ],
  public_data: [
    { value: "", label: "자동 감지", evalType: "" },
    { value: "openness", label: "개방·활용 (48점)", evalType: "public_data" },
    { value: "quality", label: "품질 (45점)", evalType: "public_data" },
    { value: "management_pub", label: "관리체계 (7점)", evalType: "public_data" },
  ],
  data_admin: [
    { value: "", label: "자동 감지", evalType: "" },
    { value: "analysis", label: "분석·활용 (50점)", evalType: "data_admin" },
    { value: "sharing", label: "공유 (45점)", evalType: "data_admin" },
    { value: "management_dba", label: "관리체계 (5점)", evalType: "data_admin" },
  ],
};

const CATEGORY_KO: Record<string, string> = {
  openness: "개방·활용",
  quality: "품질",
  management_pub: "관리체계(공공데이터)",
  analysis: "분석·활용",
  sharing: "공유",
  management_dba: "관리체계(데이터기반행정)",
};

const AREA_SCORES: Record<string, number> = {
  openness: 48,
  quality: 45,
  management_pub: 7,
  analysis: 50,
  sharing: 45,
  management_dba: 5,
};

function scoreColor(ratio: number): string {
  if (ratio >= 0.8) return "#22c55e";
  if (ratio >= 0.6) return "#eab308";
  if (ratio >= 0.4) return "#f97316";
  return "#ef4444";
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score / 100);

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          className="transition-all duration-700"
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          className="text-2xl font-bold" fill={color}>{score}</text>
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
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority] || "bg-slate-100 text-slate-700"}`}>
      {priority}
    </span>
  );
}

function ItemScoreBar({ item }: { item: EvaluationItemScore }) {
  const percentage = item.max_score > 0 ? (item.score / item.max_score) * 100 : 0;
  const color = scoreColor(item.max_score > 0 ? item.score / item.max_score : 0);
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
        <button onClick={() => setExpanded(!expanded)} className="ml-3 text-slate-400 hover:text-slate-600">
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

function AreaSubtotals({ itemScores }: { itemScores: EvaluationItemScore[] }) {
  const groups: Record<string, { score: number; max: number; areaMax: number }> = {};
  for (const item of itemScores) {
    if (!groups[item.category]) {
      groups[item.category] = { score: 0, max: 0, areaMax: AREA_SCORES[item.category] || 0 };
    }
    groups[item.category].score += item.score;
    groups[item.category].max += item.max_score;
  }

  const publicCategories = ["openness", "quality", "management_pub"];
  const adminCategories = ["analysis", "sharing", "management_dba"];

  const publicEntries = publicCategories.filter(k => groups[k]).map(k => ({ key: k, ...groups[k] }));
  const adminEntries = adminCategories.filter(k => groups[k]).map(k => ({ key: k, ...groups[k] }));

  const publicTotal = publicEntries.reduce((s, e) => s + e.score, 0);
  const publicMax = publicEntries.reduce((s, e) => s + e.max, 0);
  const adminTotal = adminEntries.reduce((s, e) => s + e.score, 0);
  const adminMax = adminEntries.reduce((s, e) => s + e.max, 0);

  const renderGroup = (
    title: string,
    entries: { key: string; score: number; max: number; areaMax: number }[],
    total: number,
    max: number,
  ) => {
    if (entries.length === 0) return null;
    const ratio = max > 0 ? total / max : 0;
    const color = scoreColor(ratio);
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
          <span className="text-lg font-bold" style={{ color }}>
            {total}<span className="text-sm font-normal text-slate-400">/{max}점</span>
          </span>
        </div>
        <div className="space-y-2">
          {entries.map((e) => {
            const r = e.max > 0 ? e.score / e.max : 0;
            const c = scoreColor(r);
            return (
              <div key={e.key} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{CATEGORY_KO[e.key] || e.key}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${r * 100}%`, backgroundColor: c }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: c }}>
                    {e.score}/{e.max}
                  </span>
                  <span className="text-xs text-slate-400">({e.areaMax}점 영역)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {renderGroup("공공데이터 제공 평가", publicEntries, publicTotal, publicMax)}
      {renderGroup("데이터기반행정 평가", adminEntries, adminTotal, adminMax)}
    </div>
  );
}

function ResultView({ result }: { result: EvaluationResult }) {
  const hasItemScores = result.item_scores && result.item_scores.length > 0;

  if (hasItemScores) {
    const totalScore = result.total_score!;
    const maxPossible = result.max_possible_score!;
    const ratio = maxPossible > 0 ? totalScore / maxPossible : 0;
    const color = scoreColor(ratio);

    // Group items by category for display
    const categoryOrder = ["openness", "quality", "management_pub", "analysis", "sharing", "management_dba"];
    const grouped: Record<string, EvaluationItemScore[]> = {};
    for (const item of result.item_scores) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    return (
      <div className="space-y-6">
        {/* Score summary */}
        <div className="flex items-start gap-6 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold" style={{ color }}>
              {totalScore}
            </span>
            <span className="text-sm text-slate-400">/ {maxPossible}점</span>
            <span className="mt-1 text-xs text-slate-400">
              (득점률 {(ratio * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold text-slate-800">평가 요약</h3>
            <p className="text-slate-600">{result.summary}</p>
            {result.category && (
              <span className="mt-2 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                {CATEGORY_KO[result.category] || result.category}
              </span>
            )}
          </div>
        </div>

        {/* Area subtotals */}
        <AreaSubtotals itemScores={result.item_scores} />

        {/* Items by category */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-800">
            항목별 평가 결과 ({result.item_scores.length}개 항목)
          </h3>
          {categoryOrder.filter(cat => grouped[cat]).map((cat) => (
            <div key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">
                  {CATEGORY_KO[cat] || cat}
                </span>
                <span className="text-xs text-slate-400">
                  ({grouped[cat].reduce((s, i) => s + i.score, 0)}/{grouped[cat].reduce((s, i) => s + i.max_score, 0)}점)
                </span>
              </div>
              <div className="space-y-2">
                {grouped[cat].map((item) => (
                  <ItemScoreBar key={item.item_id} item={item} />
                ))}
              </div>
            </div>
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
          <h3 className="mb-2 text-lg font-semibold text-slate-800">평가 요약</h3>
          <p className="text-slate-600">{result.summary}</p>
          {result.category && (
            <span className="mt-2 inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
              {CATEGORY_KO[result.category] || result.category}
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
                    <td className="py-3 pr-4 font-medium text-slate-700">{imp.category}</td>
                    <td className="py-3 pr-4 text-slate-600">{imp.issue}</td>
                    <td className="py-3 pr-4 text-slate-600">{imp.recommendation}</td>
                    <td className="py-3"><PriorityBadge priority={imp.priority} /></td>
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
  const [activeTab, setActiveTab] = useState<"text" | "file" | "history" | "criteria">("text");

  // Evaluation type
  const [evalType, setEvalType] = useState("");

  // Text evaluation state
  const [inputData, setInputData] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [itemId, setItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  // File evaluation state
  const [file, setFile] = useState<File | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [fileCategory, setFileCategory] = useState("");
  const [fileItemId, setFileItemId] = useState("");

  // Items cache for category selection
  const [categoryItemsMap, setCategoryItemsMap] = useState<Record<string, CriteriaItem[]>>({});
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

  const availableCategories = CATEGORIES[evalType] || CATEGORIES[""];

  const loadCategoryItems = useCallback(async (cat: string) => {
    if (!cat || categoryItemsMap[cat]) return;
    try {
      const res = await fetch(`${API_BASE}/projects/evaluation-rag/criteria?category=${cat}`);
      if (!res.ok) return;
      const data: CriteriaResponse = await res.json();
      const items = data.categories.flatMap((c) => c.items);
      setCategoryItemsMap((prev) => ({ ...prev, [cat]: items }));
    } catch {
      // silently fail
    }
  }, [categoryItemsMap]);

  const handleTextEvaluate = async () => {
    if (!inputData.trim() || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/projects/evaluation-rag/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_data: inputData,
          query,
          category: category || null,
          evaluation_type: evalType || null,
          item_id: itemId || null,
        }),
      });
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
      if (evalType) formData.append("evaluation_type", evalType);
      if (fileItemId) formData.append("item_id", fileItemId);

      const res = await fetch(`${API_BASE}/projects/evaluation-rag/evaluate-file`, {
        method: "POST",
        body: formData,
      });
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

  const loadCriteria = async (cat?: string) => {
    setCriteriaLoading(true);
    try {
      const url = cat
        ? `${API_BASE}/projects/evaluation-rag/criteria?category=${cat}`
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

  const CategorySelect = ({
    value,
    onChange,
    selectedItemId,
    onItemChange,
  }: {
    value: string;
    onChange: (v: string) => void;
    selectedItemId: string;
    onItemChange: (v: string) => void;
  }) => {
    const items = value ? categoryItemsMap[value] || [] : [];

    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">평가 유형</label>
          <select
            value={evalType}
            onChange={(e) => {
              setEvalType(e.target.value);
              onChange("");
              onItemChange("");
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {EVALUATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">영역 (카테고리)</label>
          <select
            value={value}
            onChange={(e) => {
              const cat = e.target.value;
              onChange(cat);
              onItemChange("");
              if (cat) loadCategoryItems(cat);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {availableCategories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        {value && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">평가 항목 (선택)</label>
            <select
              value={selectedItemId}
              onChange={(e) => onItemChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">전체 항목 평가</option>
              {items.map((item) => (
                <option key={item.item_id} value={item.item_id}>
                  {item.item_name} ({item.max_score}점)
                </option>
              ))}
            </select>
            {selectedItemId && items.length > 0 && (() => {
              const sel = items.find((i) => i.item_id === selectedItemId);
              if (!sel) return null;
              return (
                <div className="mt-2 rounded-lg bg-violet-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-mono text-violet-600">{sel.item_id}</span>
                    <span className="text-sm font-medium text-violet-800">{sel.item_name}</span>
                    <span className="text-xs text-violet-500">{sel.max_score}점 만점</span>
                  </div>
                  {sel.description && (
                    <p className="mt-1 text-xs text-slate-600">{sel.description}</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  // Group criteria by evaluation type for display
  const publicCriteria = criteria.filter((c) => c.evaluation_type === "public_data");
  const adminCriteria = criteria.filter((c) => c.evaluation_type === "data_admin");
  const ungroupedCriteria = criteria.filter((c) => !c.evaluation_type);

  const renderCriteriaGroup = (
    title: string,
    totalScore: number,
    cats: CriteriaCategory[],
  ) => {
    if (cats.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <span className="rounded-full bg-violet-100 px-3 py-0.5 text-sm font-medium text-violet-700">
            {totalScore}점 만점
          </span>
        </div>
        {cats.map((cat) => (
          <div key={cat.category_en} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-slate-800">{cat.category_ko}</h4>
                  {cat.area_score !== undefined && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                      {cat.area_score}점 영역
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{cat.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                {cat.items.length}개 항목
              </span>
            </div>
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
                        <span className="rounded bg-violet-50 px-2 py-0.5 text-xs font-mono text-violet-600">
                          {item.item_id}
                        </span>
                        <span className="font-medium text-slate-700">{item.item_name}</span>
                        {item.method && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.method === "정량" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          }`}>
                            {item.method}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{item.max_score}점</span>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-slate-400" />
                          : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">{item.description}</p>
                        <div>
                          <span className="text-xs font-semibold text-slate-500">채점 기준:</span>
                          <pre className="mt-1 max-h-96 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600">
                            {item.scoring_criteria}
                          </pre>
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
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">평가편람</h1>
        <p className="mt-1 text-sm text-slate-500">
          RAG와 Gemini를 활용한 공공데이터 평가편람 기반 자동 평가
        </p>
        <div className="mt-2 flex gap-2">
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
            공공데이터 제공 100점
          </span>
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-600">
            데이터기반행정 100점
          </span>
          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-600">
            21개 평가항목
          </span>
        </div>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">평가 대상 데이터</label>
                <textarea
                  value={inputData}
                  onChange={(e) => setInputData(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="평가할 공공데이터의 내용을 입력하세요..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">평가 질의</label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="예: 공공데이터 품질 평가"
                />
              </div>
              <CategorySelect value={category} onChange={setCategory} selectedItemId={itemId} onItemChange={setItemId} />
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
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">파일 업로드</label>
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
                    input.accept = ".pdf,.txt,.xlsx,.xls,.hwp,.hwpx,.docx";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) setFile(f);
                    };
                    input.click();
                  }}
                >
                  <FileUp className="mb-2 h-8 w-8 text-slate-400" />
                  {file ? (
                    <span className="text-sm font-medium text-violet-600">{file.name}</span>
                  ) : (
                    <>
                      <span className="text-sm text-slate-500">파일을 드래그하거나 클릭하여 업로드</span>
                      <span className="mt-1 text-xs text-slate-400">PDF, TXT, XLSX, HWP, HWPX, DOCX</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">평가 질의</label>
                <input
                  type="text"
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  placeholder="예: 공공데이터 품질 평가"
                />
              </div>
              <CategorySelect value={fileCategory} onChange={setFileCategory} selectedItemId={fileItemId} onItemChange={setFileItemId} />
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
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fileError}</div>
          )}
          {fileResult && <ResultView result={fileResult} />}
        </div>
      )}

      {/* Criteria */}
      {activeTab === "criteria" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">총 {criteriaTotal}개 평가항목</span>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-600">v2</span>
            </div>
            <select
              value={criteriaFilter}
              onChange={(e) => {
                setCriteriaFilter(e.target.value);
                loadCriteria(e.target.value || undefined);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">전체 카테고리</option>
              <optgroup label="공공데이터 제공 (100점)">
                <option value="openness">개방·활용 (48점)</option>
                <option value="quality">품질 (45점)</option>
                <option value="management_pub">관리체계 (7점)</option>
              </optgroup>
              <optgroup label="데이터기반행정 (100점)">
                <option value="analysis">분석·활용 (50점)</option>
                <option value="sharing">공유 (45점)</option>
                <option value="management_dba">관리체계 (5점)</option>
              </optgroup>
            </select>
          </div>

          {criteriaLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : criteria.length === 0 ? (
            <div className="rounded-lg border bg-white p-12 text-center text-slate-500">
              평가 기준표가 없습니다.
            </div>
          ) : (
            <div className="space-y-8">
              {renderCriteriaGroup("공공데이터 제공 평가", 100, publicCriteria)}
              {renderCriteriaGroup("데이터기반행정 평가", 100, adminCriteria)}
              {ungroupedCriteria.length > 0 && renderCriteriaGroup("기타", 0, ungroupedCriteria)}
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
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {new Date(item.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">
                          {item.query}
                        </td>
                        <td className="px-4 py-3">
                          {item.category ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                              {CATEGORY_KO[item.category] || item.category}
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
                            <span className={
                              item.score >= 80 ? "text-green-600"
                                : item.score >= 60 ? "text-yellow-600"
                                  : "text-red-600"
                            }>
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

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">전체 {historyTotal}건</span>
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
