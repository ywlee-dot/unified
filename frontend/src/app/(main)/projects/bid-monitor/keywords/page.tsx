"use client";

import { useState, useEffect } from "react";
import { BidKeyword } from "@/lib/types";

const API_BASE = "/api";

const BID_TYPE_OPTIONS = [
  { value: "goods", label: "물품", color: "#3B82F6", bg: "bg-blue-50", text: "text-blue-600" },
  { value: "services", label: "용역", color: "#8B5CF6", bg: "bg-purple-50", text: "text-purple-600" },
  { value: "construction", label: "공사", color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-600" },
];

function BidTypeTag({ type }: { type: string }) {
  const opt = BID_TYPE_OPTIONS.find((o) => o.value === type);
  if (!opt) return <span className="rounded-sm bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">{type}</span>;
  return (
    <span className={`rounded-sm px-2 py-0.5 text-xs font-medium ${opt.bg} ${opt.text}`}>
      {opt.label}
    </span>
  );
}

interface AddKeywordForm {
  keyword: string;
  bid_types: string[];
  is_active: boolean;
}

const defaultForm: AddKeywordForm = { keyword: "", bid_types: [], is_active: true };

export default function BidKeywordsPage() {
  const [keywords, setKeywords] = useState<BidKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AddKeywordForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function fetchKeywords() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords`, { credentials: "include" });
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
    if (!form.keyword.trim()) {
      setFormError("키워드는 필수 입력 항목입니다.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        keyword: form.keyword.trim(),
        bid_types: form.bid_types,
        is_active: form.is_active,
      };
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
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
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("삭제에 실패했습니다.");
      await fetchKeywords();
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류가 발생했습니다.");
    }
  }

  async function handleToggleActive(kw: BidKeyword) {
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/keywords/${kw.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !kw.is_active }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("상태 변경에 실패했습니다.");
      await fetchKeywords();
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류가 발생했습니다.");
    }
  }

  function toggleBidType(type: string) {
    setForm((f) => ({
      ...f,
      bid_types: f.bid_types.includes(type)
        ? f.bid_types.filter((t) => t !== type)
        : [...f.bid_types, type],
    }));
  }

  function formatDate(dt: string | null) {
    if (!dt) return "—";
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 rounded-lg bg-negative-bg p-5 text-negative">
        <p className="font-semibold">오류가 발생했습니다</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold leading-tight text-text-primary">키워드 관리</h1>
          <p className="mt-1 text-sm text-text-tertiary">나라장터 입찰 공고 모니터링에 사용할 키워드를 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm(defaultForm); setFormError(null); }}
          className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          + 키워드 추가
        </button>
      </div>

      {/* Keywords Table */}
      <div className="rounded-lg bg-surface-elevated shadow-md">
        {keywords.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-text-tertiary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10 opacity-40" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            <p className="text-sm">등록된 키워드가 없습니다.</p>
            <button
              onClick={() => { setShowModal(true); setForm(defaultForm); setFormError(null); }}
              className="mt-1 text-sm font-medium text-brand hover:underline"
            >
              첫 번째 키워드 추가하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-secondary bg-surface-primary">
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">키워드</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">입찰 유형</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">마지막 점검</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">활성</th>
                  <th className="px-6 py-3 text-left text-[12px] font-medium uppercase tracking-wide text-text-tertiary">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-secondary">
                {keywords.map((kw) => (
                  <tr key={kw.id} className="transition-colors hover:bg-surface-secondary">
                    <td className="px-6 py-3.5 font-semibold text-text-primary">{kw.keyword}</td>
                    <td className="px-6 py-3.5">
                      {kw.bid_types.length === 0 ? (
                        <span className="text-xs text-text-disabled">전체</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {kw.bid_types.map((t) => (
                            <BidTypeTag key={t} type={t} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-text-secondary">{formatDate(kw.last_checked_at)}</td>
                    <td className="px-6 py-3.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={kw.is_active}
                        onClick={() => handleToggleActive(kw)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
                          kw.is_active ? "bg-brand" : "bg-surface-tertiary"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                            kw.is_active ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => handleDelete(kw.id)}
                        className="text-sm font-medium text-negative opacity-70 transition-opacity hover:opacity-100"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface-elevated p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[20px] font-semibold text-text-primary">키워드 추가</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-secondary hover:text-text-secondary"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">
                  키워드 <span className="text-negative">*</span>
                </label>
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="예: 소프트웨어 개발"
                  className="w-full rounded-md bg-surface-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">입찰 유형</label>
                <div className="flex gap-2">
                  {BID_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.bid_types.includes(opt.value)}
                        onChange={() => toggleBidType(opt.value)}
                        className="h-4 w-4 rounded border-border-primary text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-text-secondary">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[12px] text-text-disabled">미선택 시 모든 유형 포함</p>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">활성 여부</label>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_active}
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 ${
                      form.is_active ? "bg-brand" : "bg-surface-tertiary"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        form.is_active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-text-secondary">{form.is_active ? "활성" : "비활성"}</span>
                </label>
              </div>

              {formError && (
                <div className="rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-10 rounded-md px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-md bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
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
