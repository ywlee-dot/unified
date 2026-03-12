"use client";

import { useState, useEffect } from "react";
import { GovKeyword } from "@/lib/types";

const API_BASE = "/api";

interface KeywordFormData {
  query: string;
  category: string;
  synonyms: string;
  institutions: string;
  leaders: string;
}

const defaultForm: KeywordFormData = {
  query: "",
  category: "",
  synonyms: "",
  institutions: "",
  leaders: "",
};

export default function GovKeywordsPage() {
  const [keywords, setKeywords] = useState<GovKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<KeywordFormData>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function fetchKeywords() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/projects/gov-news-crawler/keywords`);
      if (!res.ok) throw new Error("키워드를 불러오지 못했습니다.");
      const data = await res.json();
      setKeywords(Array.isArray(data) ? data : data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeywords();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.query.trim()) {
      setFormError("키워드는 필수 입력 항목입니다.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        query: form.query.trim(),
        category: form.category.trim() || "일반",
        synonyms: form.synonyms
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        target_entities: {
          institutions: form.institutions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          leaders: form.leaders
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      };
      const res = await fetch(`${API_BASE}/projects/gov-news-crawler/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "키워드 추가에 실패했습니다.");
      }
      setShowModal(false);
      setForm(defaultForm);
      await fetchKeywords();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 키워드를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${API_BASE}/projects/gov-news-crawler/keywords/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제에 실패했습니다.");
      await fetchKeywords();
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류가 발생했습니다.");
    }
  }

  async function handleToggleActive(kw: GovKeyword) {
    try {
      const res = await fetch(`${API_BASE}/projects/gov-news-crawler/keywords/${kw.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !kw.is_active }),
      });
      if (!res.ok) throw new Error("상태 변경에 실패했습니다.");
      await fetchKeywords();
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류가 발생했습니다.");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-red-700">
        <p className="font-medium">오류</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">키워드 관리</h1>
          <p className="mt-1 text-sm text-slate-500">크롤링에 사용할 키워드를 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(defaultForm); setFormError(null); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 키워드 추가
        </button>
      </div>

      {/* Keywords Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {keywords.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-slate-500">
            등록된 키워드가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">키워드</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">카테고리</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">유사어</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">대상 기관/인물</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">활성</th>
                  <th className="px-6 py-3 text-left font-medium text-slate-500">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-900">{kw.query}</td>
                    <td className="px-6 py-3 text-slate-600">{kw.category}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {kw.synonyms.map((s, i) => (
                          <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {kw.target_entities.institutions.map((inst, i) => (
                          <span key={`inst-${i}`} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                            {inst}
                          </span>
                        ))}
                        {kw.target_entities.leaders.map((leader, i) => (
                          <span key={`leader-${i}`} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                            {leader}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleToggleActive(kw)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          kw.is_active ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            kw.is_active ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleDelete(kw.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Keyword Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">키워드 추가</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  키워드 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.query}
                  onChange={(e) => setForm({ ...form, query: e.target.value })}
                  placeholder="예: 기후변화 대응"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">카테고리</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="예: 환경"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">유사어 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={form.synonyms}
                  onChange={(e) => setForm({ ...form, synonyms: e.target.value })}
                  placeholder="예: 탄소중립, 온실가스"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">대상 기관 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={form.institutions}
                  onChange={(e) => setForm({ ...form, institutions: e.target.value })}
                  placeholder="예: 환경부, 기상청"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">대상 인물 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={form.leaders}
                  onChange={(e) => setForm({ ...form, leaders: e.target.value })}
                  placeholder="예: 장관, 차관"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "추가 중..." : "추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
