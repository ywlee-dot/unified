"use client";

import { useState, useEffect, useRef } from "react";
import {
  Upload, FileSpreadsheet, FileText, X, Plus, Trash2,
  Play, RefreshCw, Compass, ChevronDown, ChevronUp,
  Check, Copy, Download,
} from "lucide-react";

const API_BASE = "/api/projects/da-topic-explorer";

type Step = 1 | 2 | 3;

export default function DATopicExplorerPage() {
  const [step, setStep] = useState<Step>(1);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [planTaskId, setPlanTaskId] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);

  // Load latest result on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/latest-result`);
        const data = await resp.json();
        if (data.context) {
          setPipelineResult(data);
          setStep(2);
        }
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#191F28" }}>
          공유데이터 분석주제 탐색
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#8B95A1" }}>
          기관 프로파일과 데이터 카탈로그를 AI가 분석하여 기관 간 협력 가능한 분석 주제를 도출합니다
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center">
        {[
          { num: 1 as Step, label: "기관 등록 & 업로드" },
          { num: 2 as Step, label: "AI 분석 & 주제 검토" },
          { num: 3 as Step, label: "계획서 생성" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center">
            <button
              onClick={() => setStep(s.num)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                backgroundColor: step === s.num ? "#6366F1" : step > s.num ? "#E6F9F3" : "#E8E9ED",
                color: step === s.num ? "#FFFFFF" : step > s.num ? "#00B386" : "#8B95A1",
              }}
            >
              <span
                className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: step === s.num ? "rgba(255,255,255,0.25)" : step > s.num ? "#00B386" : "#B0B8C1",
                  color: "#FFFFFF",
                }}
              >
                {step > s.num ? "✓" : s.num}
              </span>
              {s.label}
            </button>
            {idx < 2 && (
              <div className="w-6 h-0.5 mx-1" style={{ backgroundColor: step > s.num ? "#00B386" : "#E5E8EB" }} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Step1Upload onPipelineStart={(tid) => { setTaskId(tid); setStep(2); }} />
      )}
      {step === 2 && (
        <Step2Review
          taskId={taskId}
          initialResult={pipelineResult}
          onTaskUpdate={setTaskId}
          onResultLoaded={setPipelineResult}
          onSelectTopics={(ids, ctxPath) => {
            generatePlans(ids, ctxPath, setPlanTaskId, setPlans, setStep);
          }}
        />
      )}
      {step === 3 && (
        <Step3Plans planTaskId={planTaskId} plans={plans} onPlansLoaded={setPlans} />
      )}
    </div>
  );
}

async function generatePlans(
  ids: string[], ctxPath: string,
  setPlanTaskId: (id: string) => void,
  setPlans: (p: any[]) => void,
  setStep: (s: Step) => void,
) {
  try {
    const resp = await fetch(`${API_BASE}/generate-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected_topic_ids: ids, context_path: ctxPath }),
    });
    const data = await resp.json();
    if (data.task_id) {
      setPlanTaskId(data.task_id);
      setStep(3);
    }
  } catch {}
}

/* ─── Step 1: Upload ───────────────────────────────────────────────────────── */

function Step1Upload({ onPipelineStart }: { onPipelineStart: (taskId: string) => void }) {
  const [institutions, setInstitutions] = useState<{ name: string; profiles: File[]; catalog: File | null }[]>([
    { name: "", profiles: [], catalog: null },
  ]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addInst = () => setInstitutions((prev) => [...prev, { name: "", profiles: [], catalog: null }]);
  const removeInst = (idx: number) => setInstitutions((prev) => prev.filter((_, i) => i !== idx));
  const updateName = (idx: number, name: string) => {
    setInstitutions((prev) => prev.map((inst, i) => (i === idx ? { ...inst, name } : inst)));
  };

  const handleRun = async () => {
    const valid = institutions.filter((i) => i.name.trim());
    if (valid.length === 0) { setError("기관명을 하나 이상 입력해주세요."); return; }

    setUploading(true);
    setError(null);

    try {
      // Upload each institution
      for (const inst of valid) {
        const formData = new FormData();
        formData.append("institution_name", inst.name);
        inst.profiles.forEach((f) => formData.append("profile_files", f));
        if (inst.catalog) formData.append("catalog_file", inst.catalog);

        const resp = await fetch(`${API_BASE}/upload-institution`, { method: "POST", body: formData });
        if (!resp.ok) throw new Error(`${inst.name} 업로드 실패`);
      }

      // Start pipeline
      const pResp = await fetch(`${API_BASE}/run-pipeline`, { method: "POST" });
      const pData = await pResp.json();
      if (pData.task_id) onPipelineStart(pData.task_id);
      else throw new Error("파이프라인 시작 실패");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = {
    backgroundColor: "#F0F1F4", borderRadius: "10px", border: "none",
    padding: "8px 12px", fontSize: "14px", color: "#191F28", outline: "none", width: "100%",
  };

  return (
    <div className="space-y-4">
      {institutions.map((inst, idx) => (
        <div key={idx} className="rounded-xl shadow-md p-5 space-y-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>기관 {idx + 1}</h3>
            {institutions.length > 1 && (
              <button onClick={() => removeInst(idx)} className="p-1 rounded" style={{ color: "#F04452" }}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
              기관명 <span style={{ color: "#F04452" }}>*</span>
            </label>
            <input type="text" value={inst.name} onChange={(e) => updateName(idx, e.target.value)}
              placeholder="예: 한국학중앙연구원" style={inputStyle} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
              프로파일 (PDF, HWP, DOCX)
            </label>
            <input type="file" multiple accept=".pdf,.hwp,.docx"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setInstitutions((prev) => prev.map((i, ii) => ii === idx ? { ...i, profiles: files } : i));
              }}
              className="text-sm" style={{ color: "#4E5968" }} />
            {inst.profiles.length > 0 && (
              <p className="text-xs mt-1" style={{ color: "#00B386" }}>{inst.profiles.length}개 파일 선택됨</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
              데이터 카탈로그 (Excel/CSV)
            </label>
            <input type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setInstitutions((prev) => prev.map((i, ii) => ii === idx ? { ...i, catalog: f } : i));
              }}
              className="text-sm" style={{ color: "#4E5968" }} />
            {inst.catalog && (
              <p className="text-xs mt-1" style={{ color: "#00B386" }}>{inst.catalog.name}</p>
            )}
          </div>
        </div>
      ))}

      <button onClick={addInst}
        className="flex items-center gap-2 w-full justify-center py-3 rounded-xl text-sm font-medium transition-colors"
        style={{ backgroundColor: "#F0F1F4", color: "#4E5968", border: "1px dashed #B0B8C1" }}
      >
        <Plus className="h-4 w-4" /> 기관 추가
      </button>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#FFF0F1", color: "#F04452", border: "1px solid rgba(240,68,82,0.2)" }}>
          {error}
        </div>
      )}

      <button onClick={handleRun} disabled={uploading}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: "#6366F1" }}
      >
        {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {uploading ? "업로드 & 파이프라인 시작 중..." : "자동 탐색 파이프라인 시작"}
      </button>
    </div>
  );
}

/* ─── Step 2: Review ───────────────────────────────────────────────────────── */

function Step2Review({
  taskId, initialResult, onTaskUpdate, onResultLoaded, onSelectTopics,
}: {
  taskId: string | null;
  initialResult: any;
  onTaskUpdate: (id: string) => void;
  onResultLoaded: (r: any) => void;
  onSelectTopics: (ids: string[], ctxPath: string) => void;
}) {
  const [status, setStatus] = useState<string>(initialResult ? "completed" : "pending");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<any>(initialResult);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!taskId || initialResult) return;
    const poll = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/task-status/${taskId}`);
        const data = await resp.json();
        setStatus(data.status);
        setMessage(data.message || "");
        if (data.status === "completed") {
          clearInterval(poll);
          // Reload latest result
          const rResp = await fetch(`${API_BASE}/latest-result`);
          const rData = await rResp.json();
          setResult(rData);
          onResultLoaded(rData);
        } else if (data.status === "error") {
          clearInterval(poll);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(poll);
  }, [taskId]);

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const topics = result?.context?.topic_discoverer?.topics || [];
  const matcherData = result?.context?.institution_matcher || {};
  const ctxPath = result?.context?.file_path || "";

  if (status !== "completed" && status !== "error") {
    return (
      <div className="rounded-xl shadow-md p-8 text-center" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#6366F1" }} />
        <p className="text-sm font-semibold" style={{ color: "#191F28" }}>AI 에이전트 파이프라인 실행 중</p>
        <p className="text-xs mt-2" style={{ color: "#8B95A1" }}>{message}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: "#FFF0F1", border: "1px solid rgba(240,68,82,0.2)" }}>
        <p className="text-sm font-semibold" style={{ color: "#F04452" }}>파이프라인 실행 실패</p>
        <p className="text-xs mt-1" style={{ color: "#F04452" }}>{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Matcher Summary */}
      {matcherData.synergy_summary && (
        <div className="rounded-xl shadow-md p-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: "#191F28" }}>기관 매칭 시너지</h3>
          <p className="text-sm leading-relaxed" style={{ color: "#4E5968" }}>{matcherData.synergy_summary}</p>
        </div>
      )}

      {/* Topics */}
      <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #F0F1F4" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>
            도출된 분석 주제 <span style={{ color: "#8B95A1" }}>({topics.length}건)</span>
          </h3>
          <p className="text-xs mt-1" style={{ color: "#8B95A1" }}>계획서를 생성할 주제를 선택하세요</p>
        </div>
        <div className="divide-y" style={{ borderColor: "#F0F1F4" }}>
          {topics.map((topic: any) => (
            <div key={topic.id} className="px-5 py-4 flex items-start gap-3">
              <button
                onClick={() => toggleTopic(topic.id)}
                className="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: selectedTopics.has(topic.id) ? "#6366F1" : "#F0F1F4",
                  border: selectedTopics.has(topic.id) ? "none" : "1.5px solid #B0B8C1",
                }}
              >
                {selectedTopics.has(topic.id) && <Check className="h-3 w-3 text-white" />}
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "#191F28" }}>{topic.title || topic.id}</p>
                {topic.description && (
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "#4E5968" }}>{topic.description}</p>
                )}
                {topic.data_mapping && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(topic.data_mapping).map(([key, val]: [string, any]) => (
                      <span key={key} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: "#E8F1FF", color: "#0064FF" }}>
                        {key}: {typeof val === "string" ? val : JSON.stringify(val)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {topics.length > 0 && (
        <button
          onClick={() => onSelectTopics(Array.from(selectedTopics), ctxPath)}
          disabled={selectedTopics.size === 0}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: "#6366F1" }}
        >
          선택한 {selectedTopics.size}개 주제로 계획서 생성
        </button>
      )}
    </div>
  );
}

/* ─── Step 3: Plans ────────────────────────────────────────────────────────── */

function Step3Plans({
  planTaskId, plans, onPlansLoaded,
}: {
  planTaskId: string | null;
  plans: any[];
  onPlansLoaded: (p: any[]) => void;
}) {
  const [status, setStatus] = useState(plans.length > 0 ? "completed" : "pending");
  const [message, setMessage] = useState("");
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set([0]));
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!planTaskId || plans.length > 0) return;
    const poll = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/task-status/${planTaskId}`);
        const data = await resp.json();
        setStatus(data.status);
        setMessage(data.message || "");
        if (data.status === "completed") {
          clearInterval(poll);
          onPlansLoaded(data.result?.plans || []);
        } else if (data.status === "error") {
          clearInterval(poll);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(poll);
  }, [planTaskId]);

  const togglePlan = (idx: number) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const copyPlan = async (plan: any, idx: number) => {
    await navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  if (status !== "completed" && status !== "error") {
    return (
      <div className="rounded-xl shadow-md p-8 text-center" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#6366F1" }} />
        <p className="text-sm font-semibold" style={{ color: "#191F28" }}>AI가 분석 계획서를 생성하고 있습니다</p>
        <p className="text-xs mt-2" style={{ color: "#8B95A1" }}>{message}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: "#FFF0F1", border: "1px solid rgba(240,68,82,0.2)" }}>
        <p className="text-sm font-semibold" style={{ color: "#F04452" }}>계획서 생성 실패</p>
        <p className="text-xs mt-1" style={{ color: "#F04452" }}>{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: "#191F28" }}>
          분석 계획서 <span className="text-sm font-medium" style={{ color: "#8B95A1" }}>({plans.length}건)</span>
        </h3>
      </div>

      {plans.map((plan: any, idx: number) => (
        <div key={idx} className="rounded-xl shadow-md overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
          <div
            className="flex items-center justify-between px-5 py-4 cursor-pointer transition-colors"
            style={{ borderBottom: expandedPlans.has(idx) ? "1px solid #F0F1F4" : "none" }}
            onClick={() => togglePlan(idx)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "#EEF2FF", color: "#6366F1" }}>
                {idx + 1}
              </span>
              <p className="text-sm font-semibold" style={{ color: "#191F28" }}>{plan.title || plan.topic_title || `계획서 ${idx + 1}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); copyPlan(plan, idx); }}
                className="p-1.5 rounded transition-colors"
                style={{ color: "#8B95A1" }}
              >
                {copied === idx ? <Check className="h-4 w-4" style={{ color: "#00B386" }} /> : <Copy className="h-4 w-4" />}
              </button>
              {expandedPlans.has(idx) ? <ChevronUp className="h-4 w-4" style={{ color: "#8B95A1" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "#8B95A1" }} />}
            </div>
          </div>

          {expandedPlans.has(idx) && (
            <div className="px-5 py-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "#4E5968", fontFamily: "inherit" }}>
                {typeof plan === "string" ? plan : JSON.stringify(plan, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
