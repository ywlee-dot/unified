"use client";

import { useFunnel } from "@use-funnel/browser";
import { useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = "open" | "quality" | "admin";

type FunnelState = {
  intro: { category?: Category; answer1?: string; answer2?: string };
  question1: { category: Category; answer1?: string; answer2?: string };
  question2: { category: Category; answer1: string; answer2?: string };
  result: { category: Category; answer1: string; answer2: string };
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CATEGORIES: {
  id: Category;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
}[] = [
  {
    id: "open",
    label: "데이터를 개방하고 싶어요",
    description: "보유 데이터의 개방 가능 여부 판단, 설명/키워드 생성, 우수사례 검색",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "quality",
    label: "데이터 품질을 높이고 싶어요",
    description: "값진단 예외처리, 업무규칙 자동 생성, 평가편람 기반 품질 평가",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    id: "admin",
    label: "데이터기반행정을 하고 싶어요",
    description: "AI 도입 보고서, 공공데이터 활용도 제고, 공유데이터 제공 노력 보고",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
];

const QUESTIONS: Record<Category, { q1: { text: string; options: { label: string; value: string }[] }; q2: { text: string; options: { label: string; value: string }[] } }> = {
  open: {
    q1: {
      text: "현재 어떤 단계에 있나요?",
      options: [
        { label: "개방 가능한 데이터를 선별하는 단계", value: "select" },
        { label: "이미 개방할 데이터가 정해진 단계", value: "ready" },
        { label: "다른 기관의 사례를 참고하고 싶은 단계", value: "reference" },
      ],
    },
    q2: {
      text: "가장 필요한 작업은 무엇인가요?",
      options: [
        { label: "데이터 개방 가능 여부를 자동으로 판단", value: "judge" },
        { label: "개방 데이터의 설명과 키워드 자동 생성", value: "describe" },
        { label: "민간 활용 우수사례 검색", value: "search" },
      ],
    },
  },
  quality: {
    q1: {
      text: "품질 관리에서 가장 어려운 점은?",
      options: [
        { label: "값진단 시 예외처리 대상을 정하는 것", value: "exception" },
        { label: "업무규칙을 일일이 만드는 것", value: "rule" },
        { label: "평가편람 기준에 맞게 평가하는 것", value: "evaluate" },
      ],
    },
    q2: {
      text: "데이터 규모는 어느 정도인가요?",
      options: [
        { label: "소규모 (10개 이하 테이블)", value: "small" },
        { label: "중규모 (10~50개 테이블)", value: "medium" },
        { label: "대규모 (50개 이상 테이블)", value: "large" },
      ],
    },
  },
  admin: {
    q1: {
      text: "어떤 보고서를 작성해야 하나요?",
      options: [
        { label: "AI 도입/활용 사례 정성보고서", value: "ai_report" },
        { label: "공공데이터 활용도 제고 보고서", value: "utilization" },
        { label: "공유데이터 제공 노력 보고서", value: "effort" },
      ],
    },
    q2: {
      text: "보고서 작성 경험이 있나요?",
      options: [
        { label: "처음 작성해요", value: "first" },
        { label: "이전에 작성해봤지만 개선하고 싶어요", value: "improve" },
        { label: "자동화가 필요해요", value: "automate" },
      ],
    },
  },
};

type ServiceInfo = {
  name: string;
  slug: string;
  description: string;
  features: string[];
  color: string;
};

function getRecommendation(category: Category, answer1: string, answer2: string): ServiceInfo {
  if (category === "open") {
    if (answer1 === "reference" || answer2 === "search") {
      return { name: "민간 활용 우수사례 검색", slug: "best-practice-search", description: "민간 분야의 데이터 활용 우수사례를 AI 기반으로 검색하고 분석합니다.", features: ["키워드 기반 사례 검색", "AI 유사도 분석", "사례 요약 리포트"], color: "blue" };
    }
    if (answer2 === "describe" || answer1 === "ready") {
      return { name: "개방데이터 설명/키워드 자동생성", slug: "dataset-summary", description: "데이터셋의 설명과 키워드를 AI가 자동으로 생성합니다.", features: ["컬럼 분석 기반 설명 생성", "키워드 8개 자동 추출", "엑셀 일괄 처리"], color: "blue" };
    }
    return { name: "개방 가능 여부 판단", slug: "open-data-analyzer", description: "보유 데이터의 개방 가능 여부를 5단계로 자동 분석합니다.", features: ["민감정보 자동 탐지", "법규 적합성 검토", "개방 등급 판정"], color: "blue" };
  }
  if (category === "quality") {
    if (answer1 === "exception") {
      return { name: "값진단 사전 예외처리", slug: "test1", description: "값진단 시 제외해야 할 대상을 사전에 처리합니다.", features: ["파일 업로드 기반 처리", "예외 항목 자동 분류", "처리 결과 다운로드"], color: "emerald" };
    }
    if (answer1 === "evaluate") {
      return { name: "평가편람", slug: "evaluation-rag", description: "평가편람 기준에 맞는 품질 평가를 AI가 수행합니다.", features: ["RAG 기반 평가", "Gemini AI 분석", "3가지 평가 모드"], color: "emerald" };
    }
    return { name: "업무규칙 자동 생성", slug: "business-rule-gen", description: "엑셀 컬럼 정의서에서 데이터 품질 업무규칙을 자동 생성합니다.", features: ["AI 컬럼 분석", "검증 규칙 자동 생성", "엑셀 내보내기"], color: "emerald" };
  }
  // admin
  if (answer1 === "ai_report") {
    return { name: "AI 도입활용 사례 보고서", slug: "ai-case-report", description: "AI 도입 및 활용 사례에 대한 정성보고서를 자동 작성합니다.", features: ["구조화된 입력 폼", "AI 보고서 생성", "PDF 내보내기"], color: "violet" };
  }
  if (answer1 === "utilization") {
    return { name: "공공데이터 활용도 제고", slug: "data-utilization-report", description: "K-INDEX 평가지표에 맞는 활용도 제고 보고서를 생성합니다.", features: ["PDF 근거자료 분석", "평가지표 자동 매칭", "보고서 자동 작성"], color: "violet" };
  }
  return { name: "공유데이터 제공 노력", slug: "effort-public-data", description: "공유데이터 제공 노력에 대한 보고서를 작성합니다.", features: ["파일 업로드 처리", "실적 자동 집계", "보고서 생성"], color: "violet" };
}

// ---------------------------------------------------------------------------
// Step Components
// ---------------------------------------------------------------------------

const CAT_SHORT: Record<Category, string> = {
  open: "개방",
  quality: "품질",
  admin: "데이터기반행정",
};

const CAT_COLORS: Record<Category, { node: string; nodeActive: string; line: string }> = {
  open: { node: "border-blue-300 text-blue-600", nodeActive: "bg-blue-500 text-white border-blue-500 shadow-blue-500/30", line: "bg-blue-400" },
  quality: { node: "border-emerald-300 text-emerald-600", nodeActive: "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/30", line: "bg-emerald-400" },
  admin: { node: "border-violet-300 text-violet-600", nodeActive: "bg-violet-500 text-white border-violet-500 shadow-violet-500/30", line: "bg-violet-400" },
};

function TreeNode({
  label,
  isSelected,
  isClickable,
  colorClass,
  activeClass,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  isClickable: boolean;
  colorClass: string;
  activeClass: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`w-full rounded-lg border-2 px-2 py-1.5 text-[11px] font-semibold leading-tight text-center transition-all duration-200 truncate ${
        isSelected
          ? `${activeClass} shadow-sm`
          : isClickable
            ? `${colorClass} hover:opacity-80`
            : "border-border-secondary/50 text-text-disabled/50 bg-surface-secondary/30"
      }`}
      title={label}
    >
      {label}
    </button>
  );
}

const ROW_H = 40; // 34px node + 6px gap
const NODE_CENTER = 17; // half of 34px

function ConnectorSvg({ fromRow, toRow, active, color }: { fromRow: number; toRow: number; active: boolean; color: string }) {
  const svgH = 3 * ROW_H;
  const y1 = fromRow * ROW_H + NODE_CENTER;
  const y2 = toRow * ROW_H + NODE_CENTER;
  return (
    <svg width="44" height={svgH} viewBox={`0 0 44 ${svgH}`} className="shrink-0" style={{ marginTop: 0 }}>
      {active ? (
        <>
          <path
            d={`M 0 ${y1} C 18 ${y1}, 26 ${y2}, 36 ${y2}`}
            stroke="currentColor" strokeWidth="2" strokeDasharray="5 3"
            fill="none" className={color}
          />
          <path
            d={`M 32 ${y2 - 4} L 38 ${y2} L 32 ${y2 + 4}`}
            stroke="currentColor" strokeWidth="2" fill="none"
            strokeLinecap="round" strokeLinejoin="round" className={color}
          />
        </>
      ) : null}
    </svg>
  );
}

const ARROW_COLORS: Record<Category, string> = {
  open: "text-blue-400",
  quality: "text-emerald-400",
  admin: "text-violet-400",
};

function DecisionTreeMap({
  currentStep,
  context,
  onGoToStep1,
  onGoToStep2,
  onGoToStep3,
}: {
  currentStep: string;
  context: { category?: Category; answer1?: string; answer2?: string };
  onGoToStep1: () => void;
  onGoToStep2: () => void;
  onGoToStep3: () => void;
}) {
  const stepIndex = ["intro", "question1", "question2", "result"].indexOf(currentStep);
  const COL_W = "w-[160px]";
  const NODE_H = "h-[34px]";

  const hasCat = !!context.category;
  const hasAns1 = hasCat && !!context.answer1;
  const hasAns2 = hasAns1 && !!context.answer2;

  return (
    <div className="sticky top-0 z-10 border-b border-border-primary bg-surface-elevated/95 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <div className="mx-auto flex items-center justify-center px-4 py-4 min-w-[660px]">

          {/* Column 1: Categories */}
          <div className={`flex flex-col items-stretch gap-1.5 shrink-0 ${COL_W}`}>
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary text-center">1단계</div>
            {CATEGORIES.map((cat) => {
              const selected = context.category === cat.id;
              const colors = CAT_COLORS[cat.id];
              return (
                <div key={cat.id} className={NODE_H}>
                  <TreeNode
                    label={CAT_SHORT[cat.id]}
                    isSelected={selected}
                    isClickable={hasCat && stepIndex > 0}
                    colorClass="border-border-secondary text-text-disabled"
                    activeClass={selected ? colors.nodeActive : "border-border-secondary text-text-disabled"}
                    onClick={() => onGoToStep1()}
                  />
                </div>
              );
            })}
          </div>

          {/* Arrow 1→2: context에 answer1이 있을 때만 */}
          <div className="shrink-0 pt-5">
            {(() => {
              if (!hasAns1) return <div className="w-[44px]" style={{ height: 3 * ROW_H }} />;
              const fromRow = CATEGORIES.findIndex((c) => c.id === context.category);
              const q1Opts = QUESTIONS[context.category!].q1.options;
              const toRow = q1Opts.findIndex((o) => o.value === context.answer1);
              return <ConnectorSvg fromRow={fromRow} toRow={toRow >= 0 ? toRow : 0} active color={ARROW_COLORS[context.category!]} />;
            })()}
          </div>

          {/* Column 2: Question 1 options */}
          <div className={`flex flex-col items-stretch gap-1.5 shrink-0 ${COL_W}`}>
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary text-center">2단계</div>
            {hasCat ? (
              QUESTIONS[context.category!].q1.options.map((opt) => {
                const selected = context.answer1 === opt.value;
                const colors = CAT_COLORS[context.category!];
                return (
                  <div key={opt.value} className={NODE_H}>
                    <TreeNode
                      label={opt.label}
                      isSelected={selected}
                      isClickable={hasAns1 && stepIndex > 1}
                      colorClass="border-border-secondary text-text-disabled"
                      activeClass={selected ? colors.nodeActive : "border-border-secondary text-text-disabled"}
                      onClick={() => onGoToStep2()}
                    />
                  </div>
                );
              })
            ) : (
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={`${NODE_H} flex items-center justify-center`}>
                  <div className="w-full rounded-lg border-2 border-dashed border-border-secondary/30 py-1.5 text-center text-[11px] text-text-disabled/40">
                    {i === 1 ? "1단계 선택" : "\u00A0"}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Arrow 2→3: context에 answer2가 있을 때만 */}
          <div className="shrink-0 pt-5">
            {(() => {
              if (!hasAns2) return <div className="w-[44px]" style={{ height: 3 * ROW_H }} />;
              const q1Opts = QUESTIONS[context.category!].q1.options;
              const fromRow = q1Opts.findIndex((o) => o.value === context.answer1);
              const q2Opts = QUESTIONS[context.category!].q2.options;
              const toRow = q2Opts.findIndex((o) => o.value === context.answer2);
              return <ConnectorSvg fromRow={fromRow >= 0 ? fromRow : 0} toRow={toRow >= 0 ? toRow : 0} active color={ARROW_COLORS[context.category!]} />;
            })()}
          </div>

          {/* Column 3: Question 2 options */}
          <div className={`flex flex-col items-stretch gap-1.5 shrink-0 ${COL_W}`}>
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-text-tertiary text-center">3단계</div>
            {hasAns1 ? (
              QUESTIONS[context.category!].q2.options.map((opt) => {
                const selected = context.answer2 === opt.value;
                const colors = CAT_COLORS[context.category!];
                return (
                  <div key={opt.value} className={NODE_H}>
                    <TreeNode
                      label={opt.label}
                      isSelected={selected}
                      isClickable={hasAns2 && stepIndex > 2}
                      colorClass="border-border-secondary text-text-disabled"
                      activeClass={selected ? colors.nodeActive : "border-border-secondary text-text-disabled"}
                      onClick={() => onGoToStep3()}
                    />
                  </div>
                );
              })
            ) : (
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={`${NODE_H} flex items-center justify-center`}>
                  <div className="w-full rounded-lg border-2 border-dashed border-border-secondary/30 py-1.5 text-center text-[11px] text-text-disabled/40">
                    {i === 1 ? "2단계 선택" : "\u00A0"}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Arrow 3→Result: context에 answer2가 있고 result 단계일 때 */}
          <div className="shrink-0 pt-5">
            {(() => {
              if (!hasAns2 || stepIndex < 3) return <div className="w-[44px]" style={{ height: 3 * ROW_H }} />;
              const q2Opts = QUESTIONS[context.category!].q2.options;
              const fromRow = q2Opts.findIndex((o) => o.value === context.answer2);
              return <ConnectorSvg fromRow={fromRow >= 0 ? fromRow : 0} toRow={1} active color={ARROW_COLORS[context.category!]} />;
            })()}
          </div>

          {/* Result node — 세로 가운데 정렬 (row 1 = 중앙 위치) */}
          <div className="flex flex-col items-stretch shrink-0 w-[80px] pt-5" style={{ height: 3 * ROW_H + 20 }}>
            <div className="flex flex-1 flex-col items-stretch justify-center">
              {hasAns2 && stepIndex >= 3 && context.category ? (
                <div className={`w-full rounded-lg border-2 px-2 py-1.5 text-[11px] font-bold text-center ${CAT_COLORS[context.category].nodeActive} shadow-sm`}>
                  추천 결과
                </div>
              ) : (
                <div className="w-full rounded-lg border-2 border-dashed border-border-secondary/30 py-1.5 text-center text-[11px] text-text-disabled/40">
                  결과
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg">
        {children}
      </div>
    </div>
  );
}

function IntroStep({ onSelect }: { onSelect: (cat: Category) => void }) {
  return (
    <StepLayout>
      <div className="text-center mb-10">
        <h1 className="text-[28px] font-bold leading-tight text-text-primary">
          어떤 업무를
          <br />
          도와드릴까요?
        </h1>
        <p className="mt-3 text-sm text-text-tertiary">
          상황에 맞는 서비스를 추천해 드립니다
        </p>
      </div>
      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className="group flex w-full items-start gap-4 rounded-2xl bg-surface-elevated p-5 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cat.bgColor}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`h-6 w-6 ${cat.color}`}>
                <path d={cat.icon} />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-semibold text-text-primary group-hover:text-brand transition-colors">
                {cat.label}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-tertiary">
                {cat.description}
              </p>
            </div>
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-1 h-5 w-5 shrink-0 text-text-disabled group-hover:text-brand transition-colors">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        ))}
      </div>
    </StepLayout>
  );
}

function QuestionStep({
  question,
  onAnswer,
}: {
  question: { text: string; options: { label: string; value: string }[] };
  onAnswer: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (value: string) => {
    setSelected(value);
    setTimeout(() => onAnswer(value), 300);
  };

  return (
    <StepLayout>
      <h2 className="text-[24px] font-bold leading-snug text-text-primary mb-8">
        {question.text}
      </h2>
      <div className="space-y-3">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`flex w-full items-center gap-3 rounded-xl border-2 px-5 py-4 text-left text-[15px] font-medium transition-all duration-200 ${
              selected === opt.value
                ? "border-brand bg-brand/5 text-brand scale-[0.98]"
                : "border-border-primary bg-surface-elevated text-text-primary hover:border-brand/40 hover:bg-surface-secondary"
            }`}
          >
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${
              selected === opt.value
                ? "border-brand bg-brand"
                : "border-border-secondary"
            }`}>
              {selected === opt.value && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            {opt.label}
          </button>
        ))}
      </div>
    </StepLayout>
  );
}

function ResultStep({
  category,
  answer1,
  answer2,
  onRestart,
}: {
  category: Category;
  answer1: string;
  answer2: string;
  onRestart: () => void;
}) {
  const router = useRouter();
  const service = getRecommendation(category, answer1, answer2);
  const catInfo = CATEGORIES.find((c) => c.id === category)!;

  const colorMap: Record<string, { bg: string; text: string; border: string; btn: string }> = {
    blue: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-200", btn: "bg-blue-500 hover:bg-blue-600" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-200", btn: "bg-emerald-500 hover:bg-emerald-600" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-200", btn: "bg-violet-500 hover:bg-violet-600" },
  };
  const colors = colorMap[service.color];

  return (
    <StepLayout>
      <div className="text-center mb-8">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${catInfo.bgColor}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`h-8 w-8 ${catInfo.color}`}>
            <path d={catInfo.icon} />
          </svg>
        </div>
        <h2 className="text-[24px] font-bold leading-snug text-text-primary">
          추천 서비스
        </h2>
        <p className="mt-2 text-sm text-text-tertiary">
          답변을 분석한 결과, 아래 서비스를 추천합니다
        </p>
      </div>

      {/* Service Card */}
      <div className={`rounded-2xl border ${colors.border} bg-surface-elevated p-6 shadow-sm`}>
        <div className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${colors.bg} ${colors.text}`}>
          {catInfo.label.replace("하고 싶어요", "").replace("을 ", "").replace("를 ", "").trim()}
        </div>
        <h3 className="mt-3 text-[20px] font-bold text-text-primary">
          {service.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {service.description}
        </p>

        {/* Features */}
        <div className="mt-5 space-y-2.5">
          {service.features.map((feat, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3 w-3 ${colors.text}`}>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm text-text-secondary">{feat}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push(`/projects/${service.slug}`)}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white transition-all duration-200 active:scale-[0.98] ${colors.btn}`}
        >
          서비스 시작하기
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Restart */}
      <button
        onClick={onRestart}
        className="mt-4 flex w-full items-center justify-center gap-1 py-3 text-sm text-text-tertiary transition-colors hover:text-text-primary"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
        처음부터 다시하기
      </button>
    </StepLayout>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DiagnosisPage() {
  const funnel = useFunnel<FunnelState>({
    id: "diagnosis",
    initial: { step: "intro", context: {} },
  });

  return (
    <div className="flex min-h-screen flex-col bg-surface-primary">
      <DecisionTreeMap
        currentStep={funnel.step}
        context={funnel.context}
        onGoToStep1={() => {
          // 돌아갈 때 컨텍스트 유지
          const ctx = funnel.context;
          funnel.history.replace("intro", () => ({ ...ctx }));
        }}
        onGoToStep2={() => {
          const ctx = funnel.context;
          if (ctx.category) funnel.history.replace("question1", () => ({ ...ctx, category: ctx.category! }));
        }}
        onGoToStep3={() => {
          const ctx = funnel.context;
          if (ctx.category && ctx.answer1) funnel.history.replace("question2", () => ({ ...ctx, category: ctx.category!, answer1: ctx.answer1! }));
        }}
      />
      <funnel.Render
        intro={({ history, context }) => (
          <IntroStep
            onSelect={(cat) => {
              // 같은 카테고리면 유지, 다르면 이후 초기화
              if (cat === context.category) {
                history.replace("question1", () => ({ ...context, category: cat }));
              } else {
                history.replace("question1", () => ({ category: cat }));
              }
            }}
          />
        )}
        question1={({ context, history }) => (
          <QuestionStep
            question={QUESTIONS[context.category].q1}
            onAnswer={(ans) => {
              // 같은 답이면 유지, 다르면 이후 초기화
              if (ans === context.answer1) {
                history.replace("question2", () => ({ ...context, category: context.category, answer1: ans }));
              } else {
                history.replace("question2", () => ({ category: context.category, answer1: ans }));
              }
            }}
          />
        )}
        question2={({ context, history }) => (
          <QuestionStep
            question={QUESTIONS[context.category].q2}
            onAnswer={(ans) =>
              history.replace("result", () => ({ category: context.category, answer1: context.answer1, answer2: ans }))
            }
          />
        )}
        result={({ context, history }) => (
          <ResultStep
            category={context.category}
            answer1={context.answer1}
            answer2={context.answer2}
            onRestart={() => history.replace("intro", () => ({}))}
          />
        )}
      />
    </div>
  );
}
