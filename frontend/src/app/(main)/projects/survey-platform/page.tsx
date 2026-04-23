"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, FileSpreadsheet, X, Plus, Trash2, Download,
  Play, FileText, RefreshCw, ChevronDown, ChevronUp, ClipboardList,
} from "lucide-react";

const API_BASE = "/api/projects/survey-platform";

type View = "list" | "create" | "detail" | "respond";

interface SurveyItem {
  survey_id: string;
  survey_type: string;
  institution_name: string;
  start_date: string;
  end_date: string;
  status: string;
  has_report: boolean;
  response_count: number;
  created_at: string;
}

export default function SurveyPlatformPage() {
  const [view, setView] = useState<View>("list");
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);

  const openDetail = (id: string) => {
    setSelectedSurveyId(id);
    setView("detail");
  };

  const openRespond = (id: string) => {
    setSelectedSurveyId(id);
    setView("respond");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#191F28" }}>
            설문조사 생성·분석
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#8B95A1" }}>
            Excel 템플릿 기반 설문 생성, 웹 응답 수집, Gemini AI 분석 리포트 자동 생성
          </p>
        </div>
        {view !== "list" && (
          <button
            onClick={() => setView("list")}
            className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
            style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
          >
            목록으로
          </button>
        )}
      </div>

      {view === "list" && <SurveyListView onDetail={openDetail} onRespond={openRespond} onCreate={() => setView("create")} />}
      {view === "create" && <CreateSurveyView onDone={(id) => { setSelectedSurveyId(id); setView("detail"); }} />}
      {view === "detail" && selectedSurveyId && <SurveyDetailView surveyId={selectedSurveyId} />}
      {view === "respond" && selectedSurveyId && <SurveyRespondView surveyId={selectedSurveyId} onDone={() => { setView("detail"); }} />}
    </div>
  );
}

/* ─── Survey List ──────────────────────────────────────────────────────────── */

function SurveyListView({ onDetail, onRespond, onCreate }: {
  onDetail: (id: string) => void;
  onRespond: (id: string) => void;
  onCreate: () => void;
}) {
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/surveys`);
      const data = await resp.json();
      setSurveys(data.surveys || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchSurveys(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("설문을 삭제하시겠습니까?")) return;
    await fetch(`${API_BASE}/surveys/${id}`, { method: "DELETE" });
    fetchSurveys();
  };

  const statusStyle = (s: string) => {
    switch (s) {
      case "진행": return { backgroundColor: "#E6F9F3", color: "#00B386" };
      case "종료": return { backgroundColor: "#F0F1F4", color: "#8B95A1" };
      case "대기": return { backgroundColor: "#FFF5E6", color: "#FF8800" };
      default: return { backgroundColor: "#F0F1F4", color: "#8B95A1" };
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: "#0064FF" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0050CC")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0064FF")}
        >
          <Plus className="h-4 w-4" />
          새 설문 생성
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin" style={{ color: "#8B95A1" }} />
        </div>
      ) : surveys.length === 0 ? (
        <div
          className="flex h-48 flex-col items-center justify-center rounded-xl"
          style={{ border: "2px dashed #E5E8EB", backgroundColor: "#F4F5F8" }}
        >
          <ClipboardList className="mb-3 h-10 w-10" style={{ color: "#B0B8C1" }} />
          <p className="text-sm" style={{ color: "#8B95A1" }}>생성된 설문이 없습니다</p>
        </div>
      ) : (
        <div className="rounded-xl shadow-md overflow-hidden" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
          <table className="min-w-full text-sm">
            <thead style={{ backgroundColor: "#F4F5F8" }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>기관명</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>기간</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>응답</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "#8B95A1" }}>리포트</th>
                <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "#8B95A1" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map((s) => (
                <tr
                  key={s.survey_id}
                  className="transition-colors"
                  style={{ borderTop: "1px solid #F0F1F4" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onDetail(s.survey_id)}
                      className="font-medium hover:underline"
                      style={{ color: "#0064FF" }}
                    >
                      {s.institution_name}
                    </button>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#4E5968" }}>{s.survey_type}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#8B95A1" }}>
                    {s.start_date} ~ {s.end_date}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={statusStyle(s.status)}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "#191F28" }}>{s.response_count}건</td>
                  <td className="px-4 py-3">
                    {s.has_report ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#E8F1FF", color: "#0064FF" }}>완료</span>
                    ) : (
                      <span className="text-xs" style={{ color: "#B0B8C1" }}>-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {s.status === "진행" && (
                        <button
                          onClick={() => onRespond(s.survey_id)}
                          className="p-1.5 rounded transition-colors"
                          title="응답하기"
                          style={{ color: "#00B386" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E6F9F3")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s.survey_id)}
                        className="p-1.5 rounded transition-colors"
                        title="삭제"
                        style={{ color: "#F04452" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FFF0F1")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Create Survey ────────────────────────────────────────────────────────── */

function CreateSurveyView({ onDone }: { onDone: (id: string) => void }) {
  const [surveyType, setSurveyType] = useState("개방데이터");
  const [institutionName, setInstitutionName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!institutionName.trim()) { setError("기관명을 입력해주세요."); return; }
    if (!startDate || !endDate) { setError("설문 기간을 입력해주세요."); return; }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("survey_type", surveyType);
      formData.append("institution_name", institutionName);
      formData.append("start_date", startDate);
      formData.append("end_date", endDate);
      if (file) formData.append("data_file", file);

      const resp = await fetch(`${API_BASE}/surveys`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error((await resp.json()).detail || "설문 생성 실패");
      const data = await resp.json();
      if (data.success) onDone(data.survey_id);
      else throw new Error(data.error || "설문 생성 실패");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: "#F0F1F4", borderRadius: "10px", border: "none",
    padding: "8px 12px", fontSize: "14px", color: "#191F28", outline: "none", width: "100%",
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-xl shadow-md p-6 space-y-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <h2 className="text-lg font-semibold" style={{ color: "#191F28" }}>새 설문 생성</h2>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>설문 유형</label>
          <div className="flex gap-2">
            {["개방데이터", "공유데이터"].map((t) => (
              <button
                key={t}
                onClick={() => setSurveyType(t)}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: surveyType === t ? "#0064FF" : "#F0F1F4",
                  color: surveyType === t ? "#FFFFFF" : "#4E5968",
                }}
              >
                {t} 수요조사
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>
            기관명 <span style={{ color: "#F04452" }}>*</span>
          </label>
          <input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)}
            placeholder="예: 한국학중앙연구원" style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#4E5968" }}>보유 데이터 목록 (선택)</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer items-center justify-center rounded-lg p-4 transition-colors"
            style={{ border: `2px dashed ${file ? "#00B386" : "#E5E8EB"}`, backgroundColor: file ? "#E6F9F3" : "#F4F5F8" }}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            {file ? (
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" style={{ color: "#00B386" }} />
                <span className="text-sm font-medium" style={{ color: "#00B386" }}>{file.name}</span>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="ml-1 rounded p-0.5" style={{ color: "#8B95A1" }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" style={{ color: "#B0B8C1" }} />
                <span className="text-sm" style={{ color: "#4E5968" }}>Excel 파일 선택</span>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#FFF0F1", color: "#F04452", border: "1px solid rgba(240,68,82,0.2)" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed"
          style={{ backgroundColor: loading ? "#B0B8C1" : "#0064FF" }}
        >
          {loading ? "생성 중..." : "설문 생성"}
        </button>
      </div>
    </div>
  );
}

/* ─── Survey Detail ────────────────────────────────────────────────────────── */

function SurveyDetailView({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<{ ready: boolean; generated_at?: string }>({ ready: false });
  const [message, setMessage] = useState<string | null>(null);

  const fetchSurvey = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/surveys/${surveyId}`);
      if (resp.ok) setSurvey(await resp.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const checkAnalysis = async () => {
    try {
      const resp = await fetch(`${API_BASE}/surveys/${surveyId}/analysis-status`);
      if (resp.ok) setAnalysisStatus(await resp.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchSurvey(); checkAnalysis(); }, [surveyId]);

  const handleRunAnalysis = async (force = false) => {
    setAnalysisLoading(true);
    setMessage(null);
    try {
      const resp = await fetch(`${API_BASE}/surveys/${surveyId}/run-analysis?force=${force}`, { method: "POST" });
      const data = await resp.json();
      if (resp.ok) {
        setMessage(data.message || "분석이 시작되었습니다.");
        // Poll for completion
        const poll = setInterval(async () => {
          const sr = await fetch(`${API_BASE}/surveys/${surveyId}/analysis-status`);
          const sd = await sr.json();
          if (sd.ready) {
            setAnalysisStatus(sd);
            setAnalysisLoading(false);
            clearInterval(poll);
          }
        }, 3000);
        setTimeout(() => clearInterval(poll), 120000);
      } else {
        setMessage(data.detail || data.error || "분석 실행 실패");
        setAnalysisLoading(false);
      }
    } catch (err: any) {
      setMessage(err.message);
      setAnalysisLoading(false);
    }
  };

  const downloadFile = (endpoint: string, filename: string) => {
    const a = document.createElement("a");
    a.href = `${API_BASE}/surveys/${surveyId}/${endpoint}`;
    a.download = filename;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin" style={{ color: "#8B95A1" }} />
      </div>
    );
  }

  if (!survey) {
    return <div className="text-center py-8" style={{ color: "#8B95A1" }}>설문을 찾을 수 없습니다.</div>;
  }

  const meta = survey.survey_metadata;
  const statusStyle = (s: string) => {
    switch (s) {
      case "진행": return { backgroundColor: "#E6F9F3", color: "#00B386" };
      case "종료": return { backgroundColor: "#F0F1F4", color: "#8B95A1" };
      case "대기": return { backgroundColor: "#FFF5E6", color: "#FF8800" };
      default: return { backgroundColor: "#F0F1F4", color: "#8B95A1" };
    }
  };

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <div className="rounded-xl shadow-md p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#191F28" }}>{meta.institution_name}</h2>
            <p className="text-sm mt-1" style={{ color: "#8B95A1" }}>{meta.survey_type} | {meta.start_date} ~ {meta.end_date}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-sm font-medium" style={statusStyle(survey.status)}>
            {survey.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <div className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "#E8F1FF" }}>
            <span style={{ color: "#0064FF" }}>응답 </span>
            <span className="font-semibold" style={{ color: "#0064FF" }}>{survey.response_count}건</span>
          </div>
          <div className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "#F4F5F8" }}>
            <span style={{ color: "#8B95A1" }}>질문 </span>
            <span className="font-semibold" style={{ color: "#191F28" }}>{survey.questions?.length || 0}개</span>
          </div>
          <div className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "#F4F5F8" }}>
            <span style={{ color: "#8B95A1" }}>섹션 </span>
            <span className="font-semibold" style={{ color: "#191F28" }}>{survey.sections?.length || 0}개</span>
          </div>
        </div>

        {/* Survey Link */}
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "#F4F5F8" }}>
          <span style={{ color: "#8B95A1" }}>설문 ID: </span>
          <span className="font-mono font-medium" style={{ color: "#4E5968" }}>{surveyId}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl shadow-md p-6 space-y-4" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>내보내기 & 분석</h3>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadFile("export", `답변자별_결과_${surveyId}.xlsx`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
          >
            <Download className="h-4 w-4" />
            답변자별 결과
          </button>

          <button
            onClick={() => downloadFile("analysis-export", `질문별_결과_${surveyId}.xlsx`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: "#F0F1F4", color: "#4E5968" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8E9ED")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
          >
            <Download className="h-4 w-4" />
            질문별 분포
          </button>

          <button
            onClick={() => handleRunAnalysis(survey.status !== "종료")}
            disabled={analysisLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#0064FF" }}
            onMouseEnter={(e) => { if (!analysisLoading) e.currentTarget.style.backgroundColor = "#0050CC"; }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0064FF")}
          >
            {analysisLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {analysisLoading ? "분석 중..." : "AI 분석 실행"}
          </button>

          {analysisStatus.ready && (
            <button
              onClick={() => downloadFile("report", `분석리포트_${surveyId}.xlsx`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: "#00B386" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#009E77")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00B386")}
            >
              <FileText className="h-4 w-4" />
              리포트 다운로드
            </button>
          )}
        </div>

        {analysisStatus.ready && (
          <p className="text-xs" style={{ color: "#8B95A1" }}>
            마지막 분석: {analysisStatus.generated_at}
          </p>
        )}

        {message && (
          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#E8F1FF", color: "#0064FF" }}>
            {message}
          </div>
        )}
      </div>

      {/* Questions Preview */}
      <div className="rounded-xl shadow-md" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0F1F4" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#191F28" }}>
            설문 구성 <span style={{ color: "#8B95A1" }}>({survey.questions?.length || 0}개 질문)</span>
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "#F0F1F4" }}>
          {(survey.sections || []).map((section: any, sIdx: number) => (
            <div key={sIdx} className="px-6 py-4">
              <p className="text-xs font-semibold mb-2" style={{ color: "#0064FF" }}>{section.section_name}</p>
              <div className="space-y-2">
                {(section.questions || []).slice(0, 5).map((q: any, qIdx: number) => (
                  <div key={qIdx} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0 mt-0.5 text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F0F1F4", color: "#8B95A1" }}>
                      {q.question_id}
                    </span>
                    <span style={{ color: "#4E5968" }}>{q.question_text}</span>
                    {q.required && <span className="shrink-0 text-xs" style={{ color: "#F04452" }}>필수</span>}
                  </div>
                ))}
                {(section.questions || []).length > 5 && (
                  <p className="text-xs" style={{ color: "#B0B8C1" }}>
                    +{section.questions.length - 5}개 더...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Survey Respond ───────────────────────────────────────────────────────── */

function SurveyRespondView({ surveyId, onDone }: { surveyId: string; onDone: () => void }) {
  const [survey, setSurvey] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/surveys/${surveyId}`);
        if (resp.ok) setSurvey(await resp.json());
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [surveyId]);

  const setAnswer = (qid: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const toggleCheckbox = (qid: string, opt: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qid]) ? prev[qid] : [];
      return {
        ...prev,
        [qid]: current.includes(opt) ? current.filter((v: string) => v !== opt) : [...current, opt],
      };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = Object.entries(answers).map(([qid, answer]) => ({
        question_id: qid,
        answer,
      }));
      const resp = await fetch(`${API_BASE}/surveys/${surveyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      if (!resp.ok) throw new Error("제출 실패");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin" style={{ color: "#8B95A1" }} /></div>;
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-4xl mb-4">&#10003;</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "#191F28" }}>응답이 제출되었습니다</h2>
        <p className="text-sm mb-6" style={{ color: "#8B95A1" }}>설문에 참여해 주셔서 감사합니다.</p>
        <button
          onClick={onDone}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#0064FF" }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!survey) return null;

  const inputStyle = {
    backgroundColor: "#F0F1F4", borderRadius: "10px", border: "none",
    padding: "8px 12px", fontSize: "14px", color: "#191F28", outline: "none", width: "100%",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="rounded-xl shadow-md p-6" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
        <h2 className="text-lg font-semibold" style={{ color: "#191F28" }}>
          {survey.survey_metadata.institution_name} - {survey.survey_metadata.survey_type}
        </h2>
        <p className="text-sm mt-1" style={{ color: "#8B95A1" }}>
          {survey.survey_metadata.start_date} ~ {survey.survey_metadata.end_date}
        </p>
      </div>

      {(survey.sections || []).map((section: any, sIdx: number) => (
        <div key={sIdx} className="rounded-xl shadow-md p-6 space-y-5" style={{ backgroundColor: "#FFFFFF", border: "1px solid #E5E8EB" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#0064FF" }}>{section.section_name}</h3>

          {(section.questions || []).map((q: any) => (
            <div key={q.question_id} className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: "#191F28" }}>
                {q.question_text}
                {q.required && <span style={{ color: "#F04452" }}> *</span>}
              </label>

              {(q.question_type === "SINGLE_CHOICE" || q.question_type === "single_choice") && Array.isArray(q.options) && (
                <div className="space-y-1.5">
                  {q.options.map((opt: string, oIdx: number) => (
                    <label key={oIdx} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#4E5968" }}>
                      <input type="radio" name={q.question_id} value={opt} checked={answers[q.question_id] === opt}
                        onChange={() => setAnswer(q.question_id, opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {(q.question_type === "MULTI_CHOICE" || q.question_type === "multi_choice" || q.question_type === "CHECKBOX") && Array.isArray(q.options) && (
                <div className="space-y-1.5">
                  {q.options.map((opt: string, oIdx: number) => (
                    <label key={oIdx} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#4E5968" }}>
                      <input type="checkbox" checked={(answers[q.question_id] || []).includes(opt)}
                        onChange={() => toggleCheckbox(q.question_id, opt)} />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {(q.question_type === "INPUT_TEXT" || q.question_type === "short_text") && (
                <input type="text" value={answers[q.question_id] || ""} onChange={(e) => setAnswer(q.question_id, e.target.value)}
                  style={inputStyle} placeholder="답변을 입력하세요" />
              )}

              {q.question_type === "long_text" && (
                <textarea value={answers[q.question_id] || ""} onChange={(e) => setAnswer(q.question_id, e.target.value)}
                  style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} placeholder="답변을 입력하세요" />
              )}

              {(q.question_type === "RATING" || q.question_type === "rating") && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setAnswer(q.question_id, String(n))}
                      className="w-10 h-10 rounded-lg text-sm font-semibold transition-colors"
                      style={{
                        backgroundColor: answers[q.question_id] === String(n) ? "#0064FF" : "#F0F1F4",
                        color: answers[q.question_id] === String(n) ? "#FFFFFF" : "#4E5968",
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#FFF0F1", color: "#F04452" }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: "#0064FF" }}
      >
        {submitting ? "제출 중..." : "응답 제출"}
      </button>
    </div>
  );
}
