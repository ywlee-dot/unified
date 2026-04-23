"use client";

import { useState, useEffect } from "react";
import { BidMonitorConfig } from "@/lib/types";

const API_BASE = "/api";

export default function BidMonitorSettingsPage() {
  const [config, setConfig] = useState<BidMonitorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [backfillHours, setBackfillHours] = useState("24");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch(`${API_BASE}/projects/bid-monitor/config`, { credentials: "include" });
        if (!res.ok) throw new Error("설정을 불러오지 못했습니다.");
        const data: BidMonitorConfig = await res.json();
        setConfig(data);
        setWebhookUrl(data.discord_webhook_url ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  async function handleSaveWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSavingWebhook(true);
    setWebhookMessage(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_webhook_url: webhookUrl.trim() || null }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "저장에 실패했습니다.");
      }
      const updated: BidMonitorConfig = await res.json();
      setConfig(updated);
      setWebhookMessage({ text: "Discord 웹훅 URL이 저장되었습니다.", ok: true });
    } catch (e) {
      setWebhookMessage({ text: e instanceof Error ? e.message : "오류가 발생했습니다.", ok: false });
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleTestNotification() {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/check/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("테스트 알림 전송에 실패했습니다.");
      setTriggerMessage({ text: "점검이 시작되었습니다. 키워드와 매칭되는 공고가 있으면 Discord로 알림이 전송됩니다.", ok: true });
    } catch (e) {
      setTriggerMessage({ text: e instanceof Error ? e.message : "오류가 발생했습니다.", ok: false });
    } finally {
      setTriggering(false);
    }
  }

  async function handleBackfill(hours: number) {
    const h = Math.max(1, Math.min(168, Math.floor(hours)));
    setBackfilling(true);
    setBackfillMessage(null);
    try {
      const res = await fetch(`${API_BASE}/projects/bid-monitor/check/backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: h }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "백필 실행에 실패했습니다.");
      }
      const stats = await res.json();
      const summary = `수집 ${stats.total_fetched ?? 0} · 신규 ${stats.total_new ?? 0} · high ${stats.grade_high ?? 0} · medium ${stats.grade_medium ?? 0} · low ${stats.grade_low ?? 0}`;
      setBackfillMessage({ text: `백필 완료 (${h}시간 소급): ${summary}`, ok: true });
    } catch (e) {
      setBackfillMessage({ text: e instanceof Error ? e.message : "오류가 발생했습니다.", ok: false });
    } finally {
      setBackfilling(false);
    }
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
          <h1 className="text-[22px] font-bold leading-tight text-text-primary">설정</h1>
          <p className="mt-1 text-sm text-text-tertiary">입찰 공고 모니터 연동 설정을 관리합니다.</p>
        </div>
        <a href="/projects/bid-monitor/keywords" className="inline-flex h-9 items-center rounded-md bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary">
          키워드 관리
        </a>
      </div>

      {/* Discord Webhook */}
      <div className="rounded-lg bg-surface-elevated p-6 shadow-md">
        <h2 className="mb-1 text-[17px] font-semibold text-text-primary">Discord 웹훅</h2>
        <p className="mb-4 text-sm text-text-tertiary">
          키워드가 매칭되는 공고를 발견하면 지정한 Discord 채널로 알림을 전송합니다.
        </p>
        <form onSubmit={handleSaveWebhook} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">웹훅 URL</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full rounded-md bg-surface-secondary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <p className="mt-1 text-[12px] text-text-disabled">
              Discord 채널 설정 → 연동 → 웹훅에서 URL을 복사하여 입력하세요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingWebhook}
              className="h-10 rounded-md bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {savingWebhook ? "저장 중..." : "저장"}
            </button>
            {webhookMessage && (
              <p className={`text-sm font-medium ${webhookMessage.ok ? "text-positive" : "text-negative"}`}>
                {webhookMessage.text}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* API Key Status */}
      <div className="rounded-lg bg-surface-elevated p-6 shadow-md">
        <h2 className="mb-1 text-[17px] font-semibold text-text-primary">공공데이터 API 키</h2>
        <p className="mb-4 text-sm text-text-tertiary">
          나라장터 입찰 공고 수집을 위해 공공데이터포털 API 키가 필요합니다.
        </p>
        <div className="flex items-center gap-3">
          {config?.data_go_kr_api_key_set ? (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-positive-bg px-2.5 py-1 text-sm font-medium text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              API 키가 설정되어 있습니다
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-negative-bg px-2.5 py-1 text-sm font-medium text-negative">
              <span className="h-1.5 w-1.5 rounded-full bg-negative" />
              API 키가 설정되지 않았습니다
            </span>
          )}
        </div>
        {!config?.data_go_kr_api_key_set && (
          <div className="mt-3 rounded-md bg-warning-bg p-4 text-sm text-warning">
            <p className="font-semibold">API 키 설정 방법</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-warning">
              <li>
                <a
                  href="https://www.data.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  공공데이터포털(data.go.kr)
                </a>
                에서 회원가입 후 로그인
              </li>
              <li>나라장터 입찰공고정보 API 활용 신청</li>
              <li>발급된 서비스 키를 서버 환경변수 <code className="rounded bg-warning-bg px-1 font-mono text-xs">DATA_GO_KR_API_KEY</code>에 설정</li>
            </ol>
          </div>
        )}
      </div>

      {/* Check Interval */}
      <div className="rounded-lg bg-surface-elevated p-6 shadow-md">
        <h2 className="mb-1 text-[17px] font-semibold text-text-primary">점검 주기</h2>
        <p className="mb-4 text-sm text-text-tertiary">스케줄러가 자동으로 공고를 점검하는 주기입니다.</p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-md bg-surface-secondary px-4 py-2.5 text-sm text-text-primary">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-text-tertiary">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            매 <strong>{config?.check_interval_minutes ?? "—"}분</strong>마다 자동 점검
          </span>
          <p className="text-xs text-text-disabled">주기 변경은 서버 환경변수 <code className="rounded bg-surface-secondary px-1 font-mono">CHECK_INTERVAL_MINUTES</code>에서 설정합니다.</p>
        </div>
      </div>

      {/* Backfill (소급 수집) */}
      <div className="rounded-lg bg-surface-elevated p-6 shadow-md">
        <h2 className="mb-1 text-[17px] font-semibold text-text-primary">소급 백필</h2>
        <p className="mb-4 text-sm text-text-tertiary">
          서버 재시작 · 장애 등으로 공백이 생겼을 때 과거 N시간 범위의 공고를 일괄 수집합니다. (최대 168시간 / 7일)
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {[24, 72, 168].map((h) => (
            <button
              key={h}
              onClick={() => handleBackfill(h)}
              disabled={backfilling}
              className="h-10 rounded-md bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary disabled:opacity-50"
            >
              {h === 24 ? "24시간" : h === 72 ? "3일" : "7일"}
            </button>
          ))}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={backfillHours}
              onChange={(e) => setBackfillHours(e.target.value)}
              min={1}
              max={168}
              className="h-10 w-24 rounded-md bg-surface-secondary px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <span className="text-sm text-text-tertiary">시간</span>
            <button
              onClick={() => handleBackfill(Number(backfillHours))}
              disabled={backfilling || !backfillHours}
              className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {backfilling ? "실행 중..." : "백필"}
            </button>
          </div>
        </div>
        {backfillMessage && (
          <p className={`mt-3 text-sm font-medium ${backfillMessage.ok ? "text-positive" : "text-negative"}`}>
            {backfillMessage.text}
          </p>
        )}
      </div>

      {/* Test Notification */}
      <div className="rounded-lg bg-surface-elevated p-6 shadow-md">
        <h2 className="mb-1 text-[17px] font-semibold text-text-primary">수동 점검 실행</h2>
        <p className="mb-4 text-sm text-text-tertiary">
          지금 즉시 공고 점검을 실행합니다. 키워드와 매칭되는 공고가 있으면 Discord 알림이 전송됩니다.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestNotification}
            disabled={triggering}
            className="h-10 rounded-md bg-surface-secondary px-5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary disabled:opacity-50"
          >
            {triggering ? "실행 중..." : "지금 점검 실행"}
          </button>
          {triggerMessage && (
            <p className={`text-sm font-medium ${triggerMessage.ok ? "text-positive" : "text-negative"}`}>
              {triggerMessage.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
