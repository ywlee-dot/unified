"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, X, Copy, Check, FileSearch } from "lucide-react";

const API_BASE = "/api/projects/ai-data-openness";

type Phase = "phase1" | "phase2";

export default function AIDataOpennessPage() {
  const [phase, setPhase] = useState<Phase>("phase1");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#191F28" }}>
          AI 친화·고가치 데이터 개방 보고서
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#8B95A1" }}>
          개방 데이터 목록(Excel)을 업로드하면 AI가 친화·고가치 데이터를 선정하고 첨부2 보고서를 자동 생성합니다
        </p>
      </div>

      {/* Phase Tabs */}
      <div className="flex gap-2">
        {[
          { key: "phase1" as Phase, label: "Phase 1: 데이터 평가 + 보고서" },
          { key: "phase2" as Phase, label: "Phase 2: 발굴 목록 → 3-에이전트 보고서" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPhase(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: phase === tab.key ? "#0064FF" : "#F0F1F4",
              color: phase === tab.key ? "#FFFFFF" : "#4E5968",
            }}
            onMouseEnter={(e) => {
              if (phase !== tab.key) e.currentTarget.style.backgroundColor = "#E8E9ED";
            }}
            onMouseLeave={(e) => {
              if (phase !== tab.key) e.currentTarget.style.backgroundColor = "#F0F1F4";
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {phase === "phase1" ? <Phase1Panel /> : <Phase2Panel />}
    </div>
  );
}

/* ─── Phase 1 ──────────────────────────────────────────────────────────────── */

function Phase1Panel() {
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [institution, setInstitution] = useState("");
  const [providerName, setProviderName] = useState("claude");
  const [apiKey, setApiKey] = useState("");

  const [parsed, setParsed] = useState<any>(null);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setError("Excel 파일(.xlsx, .xls)만 지원합니다.");
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

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error((await resp.json()).detail || "업로드 실패");
      const data = await resp.json();
      setSessionId(data.session_id);
      setParsed(data.parsed);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("institution", institution || "공공기관");
      formData.append("provider_name", providerName);
      if (apiKey) formData.append("api_key", apiKey);
      const resp = await fetch(`${API_BASE}/evaluate`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error((await resp.json()).detail || "평가 실패");
      const data = await resp.json();
      setEvaluation(data);
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("provider_name", providerName);
      if (apiKey) formData.append("api_key", apiKey);
      const resp = await fetch(`${API_BASE}/report`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error((await resp.json()).detail || "보고서 생성 실패");
      const data = await resp.json();
      setReport(data.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/demo/parsed`);
      const data = await resp.json();
      setSessionId(data.session_id);
      setParsed(data.parsed);

      const evalResp = await fetch(`${API_BASE}/demo/evaluation`);
      const evalData = await evalResp.json();
      setEvaluation(evalData);

      const reportResp = await fetch(`${API_BASE}/demo/report`, { method: "POST" });
      const reportData = await reportResp.json();
      setReport(reportData.report);

      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setFile(null);
    setSessionId(null);
    setParsed(null);
    setEvaluation(null);
    setReport(null);
    setStep(1);
    setError(null);
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Settings */}
      <div className="space-y-4 lg:col-span-1">
        <div
          className="rounded-xl shadow-md p-5 space-y-4"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}
        >
          {/* File Upload */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
              개방 데이터 목록 (Excel)
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
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" style={{ color: "#00B386" }} />
                  <span className="text-sm font-medium" style={{ color: "#00B386" }}>{file.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="ml-1 rounded p-0.5"
                    style={{ color: "#8B95A1" }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-7 w-7" style={{ color: "#B0B8C1" }} />
                  <p className="text-sm" style={{ color: "#4E5968" }}>파일을 드래그하거나 클릭하여 선택</p>
                  <p className="mt-1 text-xs" style={{ color: "#8B95A1" }}>.xlsx, .xls</p>
                </>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #F0F1F4" }} />

          {/* Settings */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>기관명</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="예: 한국학중앙연구원"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>LLM 프로바이더</label>
              <select
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="claude">Claude</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>API Key (선택)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="환경변수 사용 시 비워두세요"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {step === 1 && (
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
              style={{ backgroundColor: loading || !file ? "#B0B8C1" : "#0064FF" }}
            >
              {loading ? "업로드 중..." : "1단계: 업로드 & 파싱"}
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleEvaluate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
              style={{ backgroundColor: loading ? "#B0B8C1" : "#0064FF" }}
            >
              {loading ? "평가 중..." : "2단계: AI 평가"}
            </button>
          )}
          {step === 3 && !report && (
            <button
              onClick={handleReport}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
              style={{ backgroundColor: loading ? "#B0B8C1" : "#0064FF" }}
            >
              {loading ? "보고서 생성 중..." : "3단계: 보고서 생성"}
            </button>
          )}

          <button
            onClick={loadDemo}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
          >
            데모 데이터로 체험
          </button>

          {(parsed || evaluation || report) && (
            <button
              onClick={reset}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ backgroundColor: "#FFF0F1", color: "#F04452" }}
            >
              초기화
            </button>
          )}
        </div>

        {error && (
          <div
            className="rounded-lg p-3 text-sm"
            style={{ backgroundColor: "#FFF0F1", color: "#F04452", border: "1px solid rgba(240,68,82,0.2)" }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div className="lg:col-span-2 space-y-4">
        {/* Parsed Data */}
        {parsed && (
          <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #F0F1F4" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>
                파싱 결과 <span style={{ color: "#8B95A1" }}>({parsed.total_count || parsed.data?.length || 0}건)</span>
              </h3>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="min-w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#F4F5F8" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>데이터명</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>분야/설명</th>
                  </tr>
                </thead>
                <tbody>
                  {(parsed.data || []).slice(0, 20).map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderTop: "1px solid #F0F1F4" }}>
                      <td className="px-3 py-2" style={{ color: "#B0B8C1" }}>{idx + 1}</td>
                      <td className="px-3 py-2 font-medium" style={{ color: "#191F28" }}>
                        {row["데이터명"] || row["이름"] || row[Object.keys(row)[1]] || "-"}
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate" style={{ color: "#4E5968" }}>
                        {row["분야"] || row["설명"] || row[Object.keys(row)[2]] || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Evaluation */}
        {evaluation && (
          <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid #F0F1F4" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>AI 평가 결과</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#E6F9F3", color: "#00B386" }}>
                선정 {evaluation.selected_count}건
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#F0F1F4", color: "#8B95A1" }}>
                총 {evaluation.total}건
              </span>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "#F4F5F8" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>우선순위</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>데이터명</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>분야</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>AI친화성</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>형태</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>선정</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(evaluation.selected || []), ...(evaluation.not_selected || [])].map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderTop: "1px solid #F0F1F4" }}>
                      <td className="px-3 py-2" style={{ color: "#4E5968" }}>{row["우선순위"] || "-"}</td>
                      <td className="px-3 py-2 font-medium" style={{ color: "#191F28" }}>{row["데이터명"]}</td>
                      <td className="px-3 py-2" style={{ color: "#4E5968" }}>{row["분야"]}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={
                            row["AI친화성"] === "상"
                              ? { backgroundColor: "#E6F9F3", color: "#00B386" }
                              : row["AI친화성"] === "중"
                              ? { backgroundColor: "#FFF5E6", color: "#FF8800" }
                              : { backgroundColor: "#F0F1F4", color: "#8B95A1" }
                          }
                        >
                          {row["AI친화성"]}
                        </span>
                      </td>
                      <td className="px-3 py-2" style={{ color: "#4E5968" }}>{row["형태"]}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={
                            row["선정여부"]
                              ? { backgroundColor: "#E6F9F3", color: "#00B386" }
                              : { backgroundColor: "#FFF0F1", color: "#F04452" }
                          }
                        >
                          {row["선정여부"] ? "선정" : "미선정"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report */}
        {report && (
          <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F0F1F4" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>첨부2 보고서</h3>
              <button
                onClick={copyReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
              >
                {copied ? <Check className="h-3.5 w-3.5" style={{ color: "#00B386" }} /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <div className="p-5">
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: "#4E5968", fontFamily: "inherit" }}
              >
                {report}
              </pre>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!parsed && !loading && (
          <div
            className="flex h-64 flex-col items-center justify-center rounded-xl"
            style={{ border: "2px dashed #E5E8EB", backgroundColor: "#F4F5F8" }}
          >
            <FileSearch className="mb-3 h-10 w-10" style={{ color: "#B0B8C1" }} />
            <p className="text-sm" style={{ color: "#8B95A1" }}>
              Excel 파일을 업로드하거나 데모를 체험해보세요
            </p>
          </div>
        )}

        {loading && (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 mx-auto" viewBox="0 0 24 24" style={{ color: "#0064FF" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="mt-3 text-sm" style={{ color: "#8B95A1" }}>AI가 처리 중입니다...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Phase 2 ──────────────────────────────────────────────────────────────── */

function Phase2Panel() {
  const [file, setFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [institution, setInstitution] = useState("");
  const [providerName, setProviderName] = useState("claude");
  const [apiKey, setApiKey] = useState("");

  const [parsed, setParsed] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("final_report");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setError("Excel 파일(.xlsx, .xls)만 지원합니다.");
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

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${API_BASE}/phase2/upload`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error((await resp.json()).detail || "업로드 실패");
      const data = await resp.json();
      setSessionId(data.session_id);
      setParsed(data.parsed);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("institution", institution || "공공기관");
      formData.append("provider_name", providerName);
      if (apiKey) formData.append("api_key", apiKey);
      const resp = await fetch(`${API_BASE}/phase2/generate`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error((await resp.json()).detail || "생성 실패");
      const data = await resp.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const parsedResp = await fetch(`${API_BASE}/phase2/demo/parsed`);
      const parsedData = await parsedResp.json();
      setSessionId(parsedData.session_id);
      setParsed(parsedData.parsed);

      const reportResp = await fetch(`${API_BASE}/phase2/demo/report`, { method: "POST" });
      const reportData = await reportResp.json();
      setResult(reportData);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setFile(null);
    setSessionId(null);
    setParsed(null);
    setResult(null);
    setStep(1);
    setError(null);
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: Settings */}
      <div className="space-y-4 lg:col-span-1">
        <div
          className="rounded-xl shadow-md p-5 space-y-4"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}
        >
          {/* File Upload */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
              발굴 목록 (Excel)
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
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" style={{ color: "#00B386" }} />
                  <span className="text-sm font-medium" style={{ color: "#00B386" }}>{file.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="ml-1 rounded p-0.5"
                    style={{ color: "#8B95A1" }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-7 w-7" style={{ color: "#B0B8C1" }} />
                  <p className="text-sm" style={{ color: "#4E5968" }}>발굴 목록 Excel을 선택하세요</p>
                  <p className="mt-1 text-xs" style={{ color: "#8B95A1" }}>.xlsx, .xls</p>
                </>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #F0F1F4" }} />

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>기관명</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="예: 한국학중앙연구원"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>LLM 프로바이더</label>
              <select
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="claude">Claude</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>API Key (선택)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="환경변수 사용 시 비워두세요"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {step === 1 && (
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed"
              style={{ backgroundColor: loading || !file ? "#B0B8C1" : "#0064FF" }}
            >
              {loading ? "업로드 중..." : "1단계: 업로드 & 파싱"}
            </button>
          )}
          {step === 2 && !result && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed"
              style={{ backgroundColor: loading ? "#B0B8C1" : "#0064FF" }}
            >
              {loading ? "3-에이전트 생성 중..." : "2단계: 보고서 생성 (Researcher → Writer → Reviewer)"}
            </button>
          )}

          <button
            onClick={loadDemo}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
          >
            데모 데이터로 체험
          </button>

          {(parsed || result) && (
            <button
              onClick={reset}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
              style={{ backgroundColor: "#FFF0F1", color: "#F04452" }}
            >
              초기화
            </button>
          )}
        </div>

        {error && (
          <div
            className="rounded-lg p-3 text-sm"
            style={{ backgroundColor: "#FFF0F1", color: "#F04452", border: "1px solid rgba(240,68,82,0.2)" }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Right: Results */}
      <div className="lg:col-span-2 space-y-4">
        {/* Parsed Data Table */}
        {parsed && (
          <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #F0F1F4" }}>
              <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>
                발굴 목록 <span style={{ color: "#8B95A1" }}>({parsed.total_count}건)</span>
              </h3>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "#F4F5F8" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>후보군명</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>담당부서</th>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>개방가능</th>
                  </tr>
                </thead>
                <tbody>
                  {(parsed.data || []).map((row: any, idx: number) => (
                    <tr key={idx} style={{ borderTop: "1px solid #F0F1F4" }}>
                      <td className="px-3 py-2" style={{ color: "#B0B8C1" }}>{row["번호"] || idx + 1}</td>
                      <td className="px-3 py-2 font-medium" style={{ color: "#191F28" }}>{row["후보군명"]}</td>
                      <td className="px-3 py-2" style={{ color: "#4E5968" }}>{row["담당부서"]}</td>
                      <td className="px-3 py-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={
                            row["개방가능여부"] === "가능"
                              ? { backgroundColor: "#E6F9F3", color: "#00B386" }
                              : { backgroundColor: "#FFF0F1", color: "#F04452" }
                          }
                        >
                          {row["개방가능여부"]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generated Report */}
        {result && (
          <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F0F1F4" }}>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>첨부2 보고서</h3>
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "#E8F1FF", color: "#0064FF" }}>
                  {result.provider}
                </span>
              </div>
              <button
                onClick={() => copyText(result.final_report || result.draft)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
              >
                {copied ? <Check className="h-3.5 w-3.5" style={{ color: "#00B386" }} /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "복사됨" : "전체 복사"}
              </button>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 px-5 pt-4">
              {[
                { key: "final_report", label: "최종 보고서" },
                { key: "section1", label: "❶ 개방 실적" },
                { key: "section2", label: "❷ 개방 계획" },
                { key: "section3", label: "❸ 데이터 설명" },
                { key: "draft", label: "초안" },
                { key: "review", label: "검토 피드백" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: activeSection === tab.key ? "#0064FF" : "#F0F1F4",
                    color: activeSection === tab.key ? "#FFFFFF" : "#8B95A1",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{ color: "#4E5968", fontFamily: "inherit" }}
              >
                {activeSection === "final_report"
                  ? result.final_report
                  : activeSection === "draft"
                  ? result.draft
                  : activeSection === "review"
                  ? result.review_feedback
                  : result.sections?.[activeSection] || "해당 섹션이 없습니다."}
              </pre>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!parsed && !loading && (
          <div
            className="flex h-64 flex-col items-center justify-center rounded-xl"
            style={{ border: "2px dashed #E5E8EB", backgroundColor: "#F4F5F8" }}
          >
            <FileSearch className="mb-3 h-10 w-10" style={{ color: "#B0B8C1" }} />
            <p className="text-sm" style={{ color: "#8B95A1" }}>
              발굴 목록 Excel을 업로드하거나 데모를 체험해보세요
            </p>
          </div>
        )}

        {loading && (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 mx-auto" viewBox="0 0 24 24" style={{ color: "#0064FF" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="mt-3 text-sm" style={{ color: "#8B95A1" }}>
                3-에이전트 파이프라인이 보고서를 생성하고 있습니다...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
