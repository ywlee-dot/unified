"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("올바른 이메일 형식을 입력해주세요");
      return;
    }
    if (!password) {
      setError("비밀번호를 입력해주세요");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return null;
  }

  return (
    <div className="w-full max-w-[400px]">
      <div className="rounded-xl border border-border-secondary bg-surface-elevated p-10 shadow-sm">
        <h1 className="text-center text-[24px] font-bold text-text-primary">
          Unified Workspace
        </h1>
        <p className="mt-2 text-center text-[14px] text-text-tertiary">
          워크스페이스에 로그인하세요
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-[13px] font-medium text-text-secondary"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-transparent bg-surface-secondary px-4 py-[14px] text-[15px] text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
              placeholder="이메일을 입력하세요"
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-[13px] font-medium text-text-secondary"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-transparent bg-surface-secondary px-4 py-[14px] text-[15px] text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>
          {error && (
            <p className="text-[13px] text-negative">{error}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-md bg-brand text-[16px] font-semibold text-text-on-color transition-colors hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
