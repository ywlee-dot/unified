"use client";

import Link from "next/link";
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
  ExternalLink,
  Star,
  ClipboardList as ClipboardListIcon,
} from "lucide-react";

const PALETTE = {
  blue:   { iconBg: "#e8f0fe", iconColor: "#1a73e8", itemHover: "#e8f0fe", itemBorder: "#1a73e8" },
  green:  { iconBg: "#e6f4ea", iconColor: "#137333", itemHover: "#e6f4ea", itemBorder: "#137333" },
  purple: { iconBg: "#f3f0ff", iconColor: "#7c3aed", itemHover: "#f3f0ff", itemBorder: "#7c3aed" },
  amber:  { iconBg: "#fef3c7", iconColor: "#b45309", itemHover: "#fef3c7", itemBorder: "#b45309" },
} as const;

type PaletteColor = typeof PALETTE[keyof typeof PALETTE];

interface CategoryItem {
  label: string;
  category: string;
  path: string;
  icon: React.ElementType;
}

interface Section {
  title: string;
  subtitle: string;
  sectionIcon: React.ElementType;
  colors: PaletteColor;
  items: CategoryItem[];
}

const SECTIONS: Section[] = [
  {
    title: "개방/활용 Agent",
    subtitle: "공공데이터 개방 가능 여부 검토부터 AI 친화 데이터셋 정의까지 개방·활용 전 주기를 지원합니다.",
    sectionIcon: ExternalLink,
    colors: PALETTE.blue,
    items: [
      { label: "개방 가능 검증", category: "데이터 개방", path: "/projects/open-data-analyzer", icon: ShieldCheck },
      { label: "민간 우수사례 탐색", category: "활용 사례", path: "/projects/best-practice-search", icon: Search },
      { label: "메타데이터 자동 완성", category: "메타데이터", path: "/projects/dataset-summary", icon: Sparkles },
      { label: "AI 데이터셋 정의", category: "AI 친화 데이터", path: "/projects/ai-data-openness", icon: FileSearch },
    ],
  },
  {
    title: "데이터 품질 Agent",
    subtitle: "업무 규칙 자동 생성, 값 진단, 오류 개선 가이드 등 데이터 품질 향상을 자동화합니다.",
    sectionIcon: Star,
    colors: PALETTE.green,
    items: [
      { label: "업무규칙 자동 생성", category: "규칙 생성", path: "/projects/business-rule-gen", icon: ClipboardCheck },
      { label: "값 진단 제외 대상", category: "품질 진단", path: "/projects/data-quality-pretest", icon: Workflow },
      { label: "진단 규칙 자동 생성", category: "규칙 생성", path: "/diagnosis", icon: ClipboardList },
      { label: "데이터 표준 사전", category: "표준화", path: "/projects/bid-monitor", icon: BookOpen },
      { label: "오류데이터 개선 가이드", category: "품질 개선", path: "/", icon: FileText },
    ],
  },
  {
    title: "데이터기반행정 Agent",
    subtitle: "공유데이터 발굴, 분석 과제 탐색, 역량 진단 등 데이터기반 행정 실현을 지원합니다.",
    sectionIcon: Landmark,
    colors: PALETTE.purple,
    items: [
      { label: "공유데이터 조사/발굴", category: "데이터 발굴", path: "/projects/effort-public-data", icon: Database },
      { label: "분석 과제 주제 발굴", category: "과제 탐색", path: "/projects/da-topic-explorer", icon: Compass },
      { label: "분석 결과 타당성 검토", category: "타당성 검토", path: "/projects/data-utilization-report", icon: BarChart3 },
      { label: "역량 진단 계획 수립", category: "역량 진단", path: "/projects/survey-platform", icon: ClipboardCheck },
      { label: "역량 개선 가이드", category: "역량 향상", path: "/projects/data-government-effort", icon: Landmark },
    ],
  },
  {
    title: "평가 공통 Agent",
    subtitle: "평가편람 자동 평가, 정성보고서 작성, 정책 변화 모니터링으로 평가 효율을 높입니다.",
    sectionIcon: ClipboardListIcon,
    colors: PALETTE.amber,
    items: [
      { label: "평가편람 RAG 자동 평가", category: "자동 평가", path: "/projects/evaluation-rag", icon: BookOpen },
      { label: "정성보고서 자동 작성", category: "보고서 생성", path: "/projects/ai-case-report", icon: FileText },
      { label: "정책 변화 실시간 모니터링", category: "정책 모니터링", path: "/projects/gov-news-crawler", icon: Newspaper },
    ],
  },
];

function ServiceItem({ item, colors }: { item: CategoryItem; colors: PaletteColor }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.path}
      className="group flex items-center gap-3 rounded-xl border border-transparent bg-[#f7f9fc] p-4 text-left transition-all duration-200"
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.backgroundColor = colors.itemHover;
        el.style.borderColor = colors.itemBorder;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.backgroundColor = "#f7f9fc";
        el.style.borderColor = "transparent";
      }}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" style={{ color: colors.iconColor }} />
      <span className="text-sm font-semibold text-[#191c1e]">{item.label}</span>
    </Link>
  );
}

function SectionCard({ section }: { section: Section }) {
  const SectionIcon = section.sectionIcon;
  const { colors } = section;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-300 hover:shadow-xl">
      <div className="p-6">
        {/* Card header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: colors.iconBg }}
            >
              <SectionIcon className="h-6 w-6" style={{ color: colors.iconColor }} />
            </div>
            <div>
              <h2 className="text-title-2 text-text-primary">{section.title}</h2>
              <p className="mt-1 text-body-2 text-text-secondary">{section.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Service items grid */}
        <div className="grid grid-cols-2 gap-3">
          {section.items.map((item) => (
            <ServiceItem key={item.path + item.label} item={item} colors={colors} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-full space-y-8">
      {/* Hero header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-title-1 text-text-primary">TU AI Agent 서비스</h1>
          <p className="mt-1 text-body-2 text-text-secondary">
            데이터 개방·품질·행정·평가를 아우르는 AI 에이전트 서비스를 한눈에 확인하세요.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-4 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-xs font-bold tracking-wider text-green-700">AI AGENTS: ONLINE</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2">
            <span className="text-xs font-bold tracking-wider text-blue-600">17개 서비스 운영 중</span>
          </div>
        </div>
      </div>

      {/* 2×2 section grid */}
      <div className="grid grid-cols-2 gap-6">
        {SECTIONS.map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}
