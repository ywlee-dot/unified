"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Search,
  Sparkles,
  FileSearch,
  ClipboardCheck,
  Workflow,
  ClipboardList,
  BookOpen,
  FileText,
  Database,
  Compass,
  BarChart3,
  Landmark,
  Newspaper,
} from "lucide-react";
import type { PipelineGraphNode, PipelineGraphEdge, PipelineGraph } from "@/components/architecture/BranchingPipeline";
import { BranchingPipeline } from "@/components/architecture/BranchingPipeline";

interface PipelineStep {
  label: string;
}

interface AgentItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  section: string;
  description: string;
  pipeline: PipelineStep[];
  pipelineGraph?: PipelineGraph;
}

const ALL_AGENTS: AgentItem[] = [
  // 개방/활용 Agent
  {
    id: "open-data-analyzer",
    label: "개방 가능 검증",
    path: "/projects/open-data-analyzer",
    icon: <ShieldCheck className="h-6 w-6" />,
    color: "#3182f6",
    section: "개방/활용 Agent",
    description: "공공데이터의 개방 가능 여부를 AI가 자동으로 판단하고 검증합니다. 법령·개인정보 기준을 적용하여 신속하게 개방 적합성을 평가합니다.",
    pipeline: [{ label: "데이터 입력" }, { label: "법령·기준 검토" }, { label: "AI 판단" }, { label: "결과 리포트" }],
  },
  {
    id: "best-practice-search",
    label: "민간 우수사례 탐색",
    path: "/projects/best-practice-search",
    icon: <Search className="h-6 w-6" />,
    color: "#3182f6",
    section: "개방/활용 Agent",
    description: "민간 영역의 데이터 활용 우수사례를 AI가 자동으로 탐색하고 정리합니다. 유사 사례 비교 분석을 통해 참고 자료를 제공합니다.",
    pipeline: [{ label: "키워드 입력" }, { label: "사례 검색" }, { label: "유사도 분석" }, { label: "리포트 생성" }],
  },
  {
    id: "dataset-summary",
    label: "메타데이터 자동 완성",
    path: "/projects/dataset-summary",
    icon: <Sparkles className="h-6 w-6" />,
    color: "#3182f6",
    section: "개방/활용 Agent",
    description: "데이터셋의 메타데이터를 AI가 자동으로 분석하고 완성합니다. 설명, 키워드, 분류 체계를 자동으로 생성하여 데이터 품질을 향상시킵니다.",
    pipeline: [{ label: "데이터셋 업로드" }, { label: "AI 분석" }, { label: "메타데이터 생성" }, { label: "검토·확정" }],
  },
  {
    id: "ai-data-openness",
    label: "AI 데이터셋 정의",
    path: "/projects/ai-data-openness",
    icon: <FileSearch className="h-6 w-6" />,
    color: "#3182f6",
    section: "개방/활용 Agent",
    description: "AI 친화 고가치 데이터셋 발굴 및 정의 기본 절차",
    pipeline: [{ label: "수요분석 및 후보 도출" }, { label: "후보 목록 정의" }, { label: "데이터 적합성 평가" }, { label: "데이터셋 범위 확정" }, { label: "AI 데이터셋 설계" }, { label: "비식별·가명 처리" }, { label: "데이터 품질 점검" }, { label: "오류데이터 정제" }, { label: "AI 메타데이터 정의" }, { label: "데이터셋 정의 완성" }],
    pipelineGraph: {
      rows: [
        [{ label: "수요분석 및 후보 도출", step: 1 }, { label: "후보 목록 정의", step: 2 }, { label: "데이터 적합성 평가", step: 3 }, { label: "데이터셋 범위 확정", step: 4 }, { label: "AI 데이터셋 설계", step: 5 }, { label: "비식별·가명 처리", step: 6, conditional: true }, { label: "오류데이터 정제", step: 8, conditional: true }, { label: "AI 메타데이터 정의", step: 9 }, { label: "데이터셋 정의 완성", step: 10 }],
        [null, null, null, null, null, { label: "데이터 품질 점검", step: 7 }, null, null, null],
      ],
      edges: [
        { from: [0, 0], to: [0, 1] },
        { from: [0, 1], to: [0, 2] },
        { from: [0, 2], to: [0, 3] },
        { from: [0, 2], to: [0, 0] },
        { from: [0, 3], to: [0, 4] },
        { from: [0, 4], to: [0, 5] },
        { from: [0, 4], to: [1, 5], srcPort: "right", tgtPort: "top" },
        { from: [0, 5], to: [1, 5] },
        { from: [1, 5], to: [0, 4], srcPort: "left", tgtPort: "bottom" },
        { from: [1, 5], to: [0, 6], srcPort: "right", tgtPort: "bottom" },
        { from: [0, 6], to: [0, 7] },
        { from: [0, 7], to: [0, 8] },
      ],
    },
  },

  // 데이터 품질 Agent
  {
    id: "business-rule-gen",
    label: "업무규칙 자동 생성",
    path: "/projects/business-rule-gen",
    icon: <ClipboardCheck className="h-6 w-6" />,
    color: "#00b386",
    section: "데이터 품질 Agent",
    description: "데이터 품질 관리를 위한 업무규칙을 AI가 자동으로 생성합니다. 데이터 특성을 분석하여 적합한 검증 규칙을 도출합니다.",
    pipeline: [{ label: "데이터 샘플 입력" }, { label: "패턴 분석" }, { label: "규칙 생성" }, { label: "규칙 검토" }],
  },
  {
    id: "data-quality-pretest",
    label: "값 진단 제외 대상",
    path: "/projects/data-quality-pretest",
    icon: <Workflow className="h-6 w-6" />,
    color: "#00b386",
    section: "데이터 품질 Agent",
    description: "데이터 값 진단 시 제외되어야 할 예외 대상을 AI가 사전에 식별합니다. 오탐을 줄이고 진단 정확도를 높입니다.",
    pipeline: [{ label: "진단 대상 입력" }, { label: "예외 패턴 분석" }, { label: "제외 목록 생성" }, { label: "적용·검증" }],
  },
  {
    id: "diagnosis",
    label: "진단 규칙 자동 생성",
    path: "/diagnosis",
    icon: <ClipboardList className="h-6 w-6" />,
    color: "#00b386",
    section: "데이터 품질 Agent",
    description: "데이터 품질 진단을 위한 규칙을 AI가 자동으로 생성합니다. 데이터 유형과 업무 맥락을 반영한 맞춤형 진단 규칙을 제공합니다.",
    pipeline: [{ label: "데이터 구조 분석" }, { label: "진단 항목 도출" }, { label: "규칙 생성" }, { label: "시뮬레이션" }],
  },
  {
    id: "bid-monitor",
    label: "데이터 표준 사전",
    path: "/projects/bid-monitor",
    icon: <BookOpen className="h-6 w-6" />,
    color: "#00b386",
    section: "데이터 품질 Agent",
    description: "기관의 데이터 표준 사전을 AI가 자동으로 구축하고 관리합니다. 용어 정의, 동의어, 표준 코드를 통합 관리합니다.",
    pipeline: [{ label: "용어 수집" }, { label: "AI 정의 생성" }, { label: "표준화 처리" }, { label: "사전 등록" }],
  },
  {
    id: "dashboard",
    label: "오류데이터 개선 가이드",
    path: "/",
    icon: <FileText className="h-6 w-6" />,
    color: "#00b386",
    section: "데이터 품질 Agent",
    description: "오류 데이터를 AI가 분석하여 개선 방향과 구체적인 가이드를 제공합니다. 오류 유형별 처리 방법과 재발 방지 방안을 안내합니다.",
    pipeline: [{ label: "오류 데이터 입력" }, { label: "오류 유형 분류" }, { label: "개선 방안 생성" }, { label: "가이드 리포트" }],
  },

  // 데이터기반행정 Agent
  {
    id: "effort-public-data",
    label: "공유데이터 조사/발굴",
    path: "/projects/effort-public-data",
    icon: <Database className="h-6 w-6" />,
    color: "#f59e0b",
    section: "데이터기반행정 Agent",
    description: "기관 간 공유 가능한 데이터를 AI가 조사하고 발굴합니다. 행정 목적 달성을 위한 공유데이터 수요와 공급을 매칭합니다.",
    pipeline: [{ label: "데이터 현황 수집" }, { label: "공유 가능성 분석" }, { label: "수요·공급 매칭" }, { label: "발굴 보고서" }],
  },
  {
    id: "da-topic-explorer",
    label: "분석 과제 주제 발굴",
    path: "/projects/da-topic-explorer",
    icon: <Compass className="h-6 w-6" />,
    color: "#f59e0b",
    section: "데이터기반행정 Agent",
    description: "데이터기반행정을 위한 분석 과제 주제를 AI가 발굴합니다. 정책 현안과 데이터 가용성을 종합 분석하여 실현 가능한 과제를 제안합니다.",
    pipeline: [{ label: "정책 현안 수집" }, { label: "데이터 연계 분석" }, { label: "주제 도출" }, { label: "과제 제안서" }],
  },
  {
    id: "data-utilization-report",
    label: "분석 결과 타당성 검토",
    path: "/projects/data-utilization-report",
    icon: <BarChart3 className="h-6 w-6" />,
    color: "#f59e0b",
    section: "데이터기반행정 Agent",
    description: "데이터 분석 결과의 통계적·논리적 타당성을 AI가 자동으로 검토합니다. 분석 방법론 적절성과 결론의 신뢰도를 평가합니다.",
    pipeline: [{ label: "분석 결과 입력" }, { label: "통계 검증" }, { label: "논리 타당성 검토" }, { label: "검토 의견서" }],
  },
  {
    id: "survey-platform",
    label: "역량 진단 계획 수립",
    path: "/projects/survey-platform",
    icon: <ClipboardCheck className="h-6 w-6" />,
    color: "#f59e0b",
    section: "데이터기반행정 Agent",
    description: "기관 데이터 역량 진단을 위한 계획을 AI가 수립합니다. 진단 항목, 방법, 일정을 자동으로 구성하여 체계적인 역량 평가를 지원합니다.",
    pipeline: [{ label: "기관 현황 입력" }, { label: "진단 항목 설계" }, { label: "계획서 생성" }, { label: "일정 수립" }],
  },
  {
    id: "data-government-effort",
    label: "역량 개선 가이드",
    path: "/projects/data-government-effort",
    icon: <Landmark className="h-6 w-6" />,
    color: "#f59e0b",
    section: "데이터기반행정 Agent",
    description: "진단 결과를 바탕으로 기관 데이터 역량 개선 방향을 AI가 제시합니다. 단계별 개선 로드맵과 구체적인 실행 방안을 제공합니다.",
    pipeline: [{ label: "진단 결과 입력" }, { label: "취약점 분석" }, { label: "개선 방안 도출" }, { label: "로드맵 생성" }],
  },

  // 평가 공통 Agent
  {
    id: "evaluation-rag",
    label: "평가편람 RAG 자동 평가",
    path: "/projects/evaluation-rag",
    icon: <BookOpen className="h-6 w-6" />,
    color: "#8b5cf6",
    section: "평가 공통 Agent",
    description: "평가편람 기반 RAG 시스템으로 평가 항목을 자동 채점합니다. 관련 근거를 검색하고 평가 기준에 따라 정확한 점수를 산출합니다.",
    pipeline: [{ label: "평가 자료 입력" }, { label: "편람 RAG 검색" }, { label: "자동 채점" }, { label: "평가 결과 생성" }],
  },
  {
    id: "ai-case-report",
    label: "정성보고서 자동 작성",
    path: "/projects/ai-case-report",
    icon: <FileText className="h-6 w-6" />,
    color: "#8b5cf6",
    section: "평가 공통 Agent",
    description: "정량 데이터와 사례를 기반으로 정성 평가 보고서를 AI가 자동 작성합니다. 일관된 양식과 논리적 서술로 보고서 품질을 높입니다.",
    pipeline: [{ label: "데이터·사례 수집" }, { label: "핵심 내용 분석" }, { label: "보고서 초안 생성" }, { label: "검토·완성" }],
  },
  {
    id: "gov-news-crawler",
    label: "정책 변화 실시간 모니터링",
    path: "/projects/gov-news-crawler",
    icon: <Newspaper className="h-6 w-6" />,
    color: "#8b5cf6",
    section: "평가 공통 Agent",
    description: "정부 정책 및 법령 변화를 AI가 실시간으로 모니터링합니다. 평가 기준에 영향을 미치는 변경 사항을 즉시 감지하고 알림을 제공합니다.",
    pipeline: [{ label: "정보 소스 수집" }, { label: "변화 감지" }, { label: "영향도 분석" }, { label: "알림·리포트" }],
  },
];


// ---------------------------------------------------------------------------
// Diagnosis – 가로 흐름 리디자인
// ---------------------------------------------------------------------------

type Category = "open" | "quality" | "admin";

const CATEGORIES: { id: Category; label: string; description: string; icon: string; color: string; bgColor: string }[] = [
  { id: "open", label: "데이터를 개방하고 싶어요", description: "보유 데이터의 개방 가능 여부 판단, 설명/키워드 생성, 우수사례 검색", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { id: "quality", label: "데이터 품질을 높이고 싶어요", description: "값진단 예외처리, 업무규칙 자동 생성, 평가편람 기반 품질 평가", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { id: "admin", label: "데이터기반행정을 하고 싶어요", description: "AI 도입 보고서, 공공데이터 활용도 제고, 공유데이터 제공 노력 보고", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", color: "text-violet-500", bgColor: "bg-violet-500/10" },
];

const QUESTIONS: Record<Category, { q1: { text: string; options: { label: string; value: string }[] }; q2: { text: string; options: { label: string; value: string }[] } }> = {
  open: {
    q1: { text: "현재 어떤 단계에 있나요?", options: [{ label: "개방 가능한 데이터를 선별하는 단계", value: "select" }, { label: "이미 개방할 데이터가 정해진 단계", value: "ready" }, { label: "다른 기관의 사례를 참고하고 싶은 단계", value: "reference" }] },
    q2: { text: "가장 필요한 작업은 무엇인가요?", options: [{ label: "데이터 개방 가능 여부를 자동으로 판단", value: "judge" }, { label: "개방 데이터의 설명과 키워드 자동 생성", value: "describe" }, { label: "민간 활용 우수사례 검색", value: "search" }] },
  },
  quality: {
    q1: { text: "품질 관리에서 가장 어려운 점은?", options: [{ label: "값진단 시 예외처리 대상을 정하는 것", value: "exception" }, { label: "업무규칙을 일일이 만드는 것", value: "rule" }, { label: "평가편람 기준에 맞게 평가하는 것", value: "evaluate" }] },
    q2: { text: "데이터 규모는 어느 정도인가요?", options: [{ label: "소규모 (10개 이하 테이블)", value: "small" }, { label: "중규모 (10~50개 테이블)", value: "medium" }, { label: "대규모 (50개 이상 테이블)", value: "large" }] },
  },
  admin: {
    q1: { text: "어떤 보고서를 작성해야 하나요?", options: [{ label: "AI 도입/활용 사례 정성보고서", value: "ai_report" }, { label: "공공데이터 활용도 제고 보고서", value: "utilization" }, { label: "공유데이터 제공 노력 보고서", value: "effort" }] },
    q2: { text: "보고서 작성 경험이 있나요?", options: [{ label: "처음 작성해요", value: "first" }, { label: "이전에 작성해봤지만 개선하고 싶어요", value: "improve" }, { label: "자동화가 필요해요", value: "automate" }] },
  },
};

type ServiceInfo = { name: string; slug: string; description: string; features: string[]; color: string };

function getRecommendation(category: Category, answer1: string, answer2: string): ServiceInfo {
  if (category === "open") {
    if (answer1 === "reference" || answer2 === "search") return { name: "민간 활용 우수사례 검색", slug: "best-practice-search", description: "민간 분야의 데이터 활용 우수사례를 AI 기반으로 검색하고 분석합니다.", features: ["키워드 기반 사례 검색", "AI 유사도 분석", "사례 요약 리포트"], color: "blue" };
    if (answer2 === "describe" || answer1 === "ready") return { name: "개방데이터 설명/키워드 자동생성", slug: "dataset-summary", description: "데이터셋의 설명과 키워드를 AI가 자동으로 생성합니다.", features: ["컬럼 분석 기반 설명 생성", "키워드 8개 자동 추출", "엑셀 일괄 처리"], color: "blue" };
    return { name: "개방 가능 여부 판단", slug: "open-data-analyzer", description: "보유 데이터의 개방 가능 여부를 5단계로 자동 분석합니다.", features: ["민감정보 자동 탐지", "법규 적합성 검토", "개방 등급 판정"], color: "blue" };
  }
  if (category === "quality") {
    if (answer1 === "exception") return { name: "값진단 사전 예외처리", slug: "data-quality-pretest", description: "값진단 시 제외해야 할 대상을 사전에 처리합니다.", features: ["파일 업로드 기반 처리", "예외 항목 자동 분류", "처리 결과 다운로드"], color: "emerald" };
    if (answer1 === "evaluate") return { name: "평가편람", slug: "evaluation-rag", description: "평가편람 기준에 맞는 품질 평가를 AI가 수행합니다.", features: ["RAG 기반 평가", "Gemini AI 분석", "3가지 평가 모드"], color: "emerald" };
    return { name: "업무규칙 자동 생성", slug: "business-rule-gen", description: "엑셀 컬럼 정의서에서 데이터 품질 업무규칙을 자동 생성합니다.", features: ["AI 컬럼 분석", "검증 규칙 자동 생성", "엑셀 내보내기"], color: "emerald" };
  }
  if (answer1 === "ai_report") return { name: "AI 도입활용 사례 보고서", slug: "ai-case-report", description: "AI 도입 및 활용 사례에 대한 정성보고서를 자동 작성합니다.", features: ["구조화된 입력 폼", "AI 보고서 생성", "PDF 내보내기"], color: "violet" };
  if (answer1 === "utilization") return { name: "공공데이터 활용도 제고", slug: "data-utilization-report", description: "K-INDEX 평가지표에 맞는 활용도 제고 보고서를 생성합니다.", features: ["PDF 근거자료 분석", "평가지표 자동 매칭", "보고서 자동 작성"], color: "violet" };
  return { name: "공유데이터 제공 노력", slug: "effort-public-data", description: "공유데이터 제공 노력에 대한 보고서를 작성합니다.", features: ["파일 업로드 처리", "실적 자동 집계", "보고서 생성"], color: "violet" };
}

const CAT_SHORT: Record<Category, string> = { open: "개방", quality: "품질", admin: "데이터기반행정" };
type StepRecord =
  | { type: "intro"; label: string; selected: Category; selectedLabel: string }
  | { type: "question1"; label: string; selected: string; selectedLabel: string }
  | { type: "question2"; label: string; selected: string; selectedLabel: string };

function SummaryCard({ step, stepIndex, onGoBack }: { step: StepRecord; stepIndex: number; onGoBack: (idx: number) => void }) {
  const stepLabels = ["1단계", "2단계", "3단계"];
  return (
    <button
      onClick={() => onGoBack(stepIndex)}
      className="w-[160px] shrink-0 rounded-xl border border-border-primary bg-surface-elevated p-3 text-left transition-all hover:shadow-md hover:border-brand/40 active:scale-[0.97]"
    >
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">{stepLabels[stepIndex]}</div>
      <div className="mt-1 text-[11px] text-text-tertiary truncate">{step.label}</div>
      <div className="mt-1 text-[13px] font-semibold text-brand truncate">{step.selectedLabel}</div>
      <div className="mt-1.5 text-[10px] text-text-disabled hover:text-brand">클릭하여 변경</div>
    </button>
  );
}

function StepArrow() {
  return (
    <div className="w-[40px] shrink-0 flex items-center justify-center">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-text-disabled">
        <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FutureSteps({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex-1 flex items-center ml-4">
      {Array.from({ length: count }, (_, i) => (
        <Fragment key={i}>
          <div className="flex-1 min-w-6 border-t-2 border-dashed border-border-strong" />
          <div className="w-7 h-7 rounded-full border-2 border-dashed border-border-strong bg-surface-tertiary/60 shrink-0" />
        </Fragment>
      ))}
    </div>
  );
}


function IntroCard({ onSelect }: { onSelect: (cat: Category) => void }) {
  return (
    <div className="w-[400px] shrink-0 animate-[fadeSlideIn_0.45s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
      <div className="space-y-2.5">
        {CATEGORIES.map((cat) => (
          <button key={cat.id} onClick={() => onSelect(cat.id)} className="group flex w-full items-start gap-3 rounded-xl bg-surface-elevated p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] border border-border-secondary">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cat.bgColor}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${cat.color}`}><path d={cat.icon} /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-text-primary group-hover:text-brand transition-colors">{cat.label}</h3>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-tertiary line-clamp-2">{cat.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ question, onAnswer }: { question: { text: string; options: { label: string; value: string }[] }; onAnswer: (value: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const handleSelect = (value: string) => { setSel(value); setTimeout(() => onAnswer(value), 300); };
  return (
    <div className="w-[380px] shrink-0 animate-[fadeSlideIn_0.45s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
      <h2 className="text-[18px] font-bold text-text-primary mb-5 text-center">Q. {question.text}</h2>
      <div className="space-y-2.5">
        {question.options.map((opt) => (
          <button key={opt.value} onClick={() => handleSelect(opt.value)}
            className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-[14px] font-medium transition-all duration-200 ${sel === opt.value ? "border-brand bg-brand/5 text-brand scale-[0.98]" : "border-border-primary bg-surface-elevated text-text-primary hover:border-brand/40"}`}
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 ${sel === opt.value ? "border-brand bg-brand" : "border-border-secondary"}`}>
              {sel === opt.value && <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-white"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
            </div>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultCard({ category, answer1, answer2, onRestart }: { category: Category; answer1: string; answer2: string; onRestart: () => void }) {
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
    <div className="w-[380px] shrink-0 animate-[fadeSlideIn_0.45s_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
      <div>
        <div className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] font-semibold ${colors.bg} ${colors.text}`}>추천 서비스</div>
        <h3 className="mt-2.5 text-[17px] font-bold text-text-primary">{service.name}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{service.description}</p>
        <div className="mt-3 space-y-1.5">
          {service.features.map((feat, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-2.5 w-2.5 ${colors.text}`}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              </div>
              <span className="text-[13px] text-text-secondary">{feat}</span>
            </div>
          ))}
        </div>
        <button onClick={() => router.push(`/projects/${service.slug}`)} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold text-white transition-all duration-200 active:scale-[0.98] ${colors.btn}`}>
          서비스 시작하기
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </button>
      </div>
    </div>
  );
}

function DiagnosisFunnel() {
  const [completedSteps, setCompletedSteps] = useState<StepRecord[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const category = completedSteps.find(s => s.type === "intro")?.selected as Category | undefined;
  const answer1 = completedSteps.find(s => s.type === "question1")?.selected;
  const answer2 = completedSteps.find(s => s.type === "question2")?.selected;

  const TOTAL_STEPS = 8;
  const activeStep = answer2 ? "result"
    : answer1 ? "question2"
    : category ? "question1"
    : "intro";
  const usedSteps = completedSteps.length + 1;
  const remainingSteps = activeStep === "result" ? 0 : Math.max(0, TOTAL_STEPS - usedSteps);

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ left: scrollRef.current!.scrollWidth, behavior: "smooth" });
      });
    }
  }, [completedSteps.length]);

  const onGoBack = (stepIndex: number) => {
    setCompletedSteps(prev => prev.slice(0, stepIndex));
  };

  const handleCategorySelect = (cat: Category) => {
    const catInfo = CATEGORIES.find(c => c.id === cat)!;
    setCompletedSteps([{ type: "intro", label: catInfo.label, selected: cat, selectedLabel: CAT_SHORT[cat] }]);
  };

  const handleAnswer1 = (value: string) => {
    if (!category) return;
    const opt = QUESTIONS[category].q1.options.find(o => o.value === value)!;
    setCompletedSteps(prev => [
      ...prev.filter(s => s.type === "intro"),
      { type: "question1", label: QUESTIONS[category].q1.text, selected: value, selectedLabel: opt.label },
    ]);
  };

  const handleAnswer2 = (value: string) => {
    if (!category) return;
    const opt = QUESTIONS[category].q2.options.find(o => o.value === value)!;
    setCompletedSteps(prev => [
      ...prev.filter(s => s.type !== "question2"),
      { type: "question2", label: QUESTIONS[category].q2.text, selected: value, selectedLabel: opt.label },
    ]);
  };

  return (
    <div ref={scrollRef} className="overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-0 py-2 w-[80%] min-w-fit min-h-[360px]">
        {completedSteps.map((step, i) => (
          <Fragment key={`${step.type}-${i}`}>
            <SummaryCard step={step} stepIndex={i} onGoBack={onGoBack} />
            <StepArrow />
          </Fragment>
        ))}
        {activeStep === "intro" && <IntroCard onSelect={handleCategorySelect} />}
        {activeStep === "question1" && category && <QuestionCard question={QUESTIONS[category].q1} onAnswer={handleAnswer1} />}
        {activeStep === "question2" && category && <QuestionCard question={QUESTIONS[category].q2} onAnswer={handleAnswer2} />}
        {activeStep === "result" && category && answer1 && answer2 && <ResultCard category={category} answer1={answer1} answer2={answer2} onRestart={() => setCompletedSteps([])} />}
        <FutureSteps count={remainingSteps} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Pipeline({ steps, color }: { steps: PipelineStep[]; color: string }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl p-6 scrollbar-hide"
      style={{
        backgroundColor: "#f9fafb",
        border: `1px solid ${color}25`,
      }}
    >
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start">
            {/* 노드 */}
            <div className="flex flex-col items-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-md">
                {/* 왼쪽 포트 */}
                {i > 0 && (
                  <div className="absolute -left-1.5 top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-gray-300 bg-white" />
                )}
                {/* 번호 */}
                <span className="text-lg font-bold" style={{ color }}>
                  {i + 1}
                </span>
                {/* 오른쪽 포트 */}
                {i < steps.length - 1 && (
                  <div className="absolute -right-1.5 top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </div>
              <span className="mt-2 w-[80px] text-center text-[11px] font-medium leading-tight text-gray-600">
                {step.label}
              </span>
            </div>

            {/* 점선 커넥터 */}
            {i < steps.length - 1 && (
              <div
                className="mt-8 h-px w-16 shrink-0"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, #d1d5db 0, #d1d5db 5px, transparent 5px, transparent 8px)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



export default function DashboardPage() {
  const [selected, setSelected] = useState<AgentItem | null>(null);
  const [triangleLeft, setTriangleLeft] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleCardClick = (item: AgentItem, e: React.MouseEvent<HTMLButtonElement>) => {
    const isActive = selected?.id === item.id;
    if (!isActive && wrapperRef.current) {
      const btnRect = e.currentTarget.getBoundingClientRect();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      // 카드 중앙 - 삼각형 너비(8px) 보정
      const left = btnRect.left + btnRect.width / 2 - wrapperRect.left - 8;
      setTriangleLeft(Math.max(0, left));
    }
    setSelected(isActive ? null : item);
  };

  return (
    <div ref={wrapperRef}>
      <h1 className="text-title-1 text-text-primary">TU AI Agent 서비스</h1>
      <p className="mb-8 mt-1 text-body-2 text-text-secondary">
        AI Agent를 선택하면 상세 내용을 확인할 수 있습니다
      </p>

      {/* 전체 항목 수평 슬라이드 */}
      <div ref={scrollRef} onWheel={handleWheel} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {ALL_AGENTS.map((item) => {
          const isActive = selected?.id === item.id;
          return (
            <button
              key={item.id}
              onClick={(e) => handleCardClick(item, e)}
              className="flex min-w-[144px] shrink-0 flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 transition-all duration-150"
              style={{
                borderColor: isActive ? item.color : "transparent",
                backgroundColor: `${item.color}${isActive ? "14" : "0a"}`,
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${item.color}18`, color: item.color }}
              >
                {item.icon}
              </div>
              <span className="whitespace-nowrap text-center text-[12px] font-medium leading-tight text-text-primary">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 상세 패널 */}
      {selected && (
        <div key={selected.id} className="mt-2 animate-[expandDown_0.35s_cubic-bezier(0.16,1,0.3,1)]">
          {/* 연결 트라이앵글 */}
          <div
            style={{
              marginLeft: `${triangleLeft}px`,
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: `8px solid ${selected.color}`,
            }}
          />
          <div
            className="rounded-xl border p-6 transition-all duration-200"
            style={{
              borderColor: `${selected.color}40`,
              borderTopColor: selected.color,
              borderTopWidth: "2px",
              backgroundColor: `${selected.color}08`,
            }}
          >
          {/* 헤더 */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: `${selected.color}18`, color: selected.color }}
            >
              {selected.icon}
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: selected.color }}>
                {selected.section}
              </p>
              <h3 className="text-title-3 text-text-primary">{selected.label}</h3>
            </div>
          </div>

          {/* 설명 */}
          <p className="text-body-2 text-text-secondary mb-5">{selected.description}</p>

          {/* 파이프라인 */}
          <div>
            {selected.pipelineGraph ? (
              <BranchingPipeline graph={selected.pipelineGraph} color={selected.color} />
            ) : (
              <Pipeline steps={selected.pipeline} color={selected.color} />
            )}
          </div>
        </div>
        </div>
      )}

      {/* 서비스 추천 진단 */}
      <div className="mt-10">
        <div className="mb-5 flex items-start gap-2.5">
          <span className="mt-1 h-10 w-[2px] shrink-0 rounded-full bg-brand" />
          <div>
            <h2 className="text-[18px] font-semibold text-text-primary">서비스 추천 진단</h2>
            <p className="mt-1 text-sm text-text-tertiary">상황에 맞는 서비스를 추천해 드립니다</p>
          </div>
        </div>
        <DiagnosisFunnel />
      </div>
    </div>
  );
}
