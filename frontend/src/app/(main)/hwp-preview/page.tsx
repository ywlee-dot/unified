'use client';

import { useState } from 'react';
import { HwpDocumentPreview, HwpDocumentData } from '@/components/shared/HwpDocumentPreview';
import { FileText, Layout, Table2, List, Type, AlignLeft } from 'lucide-react';

// ── 샘플 데이터: 탭(실적) 구조 ───────────────────────────────────────────────
const SAMPLE_TABS: HwpDocumentData = {
  title: 'AI 도입활용 사례 정성보고서',
  subtitle: '데이터기반행정 실태평가 3-3-2 AI 도입활용 사례 및 추진노력',
  organization: '한국학중앙연구원',
  date: '2025년 12월',
  tabs: [
    {
      label: '실적 1',
      meta: [
        { label: '실적 번호', value: '실적 1' },
        { label: '증빙 파일', value: ['2024년도 AI 신기술 이용료 지원 시행계획 보고.pdf', '내부결재문서.pdf'] },
      ],
      sections: [
        {
          heading: '추진실적명',
          content: '2024년도 인공지능(AI) 신기술 이용료 지원 시행계획',
        },
        {
          heading: '추진기간',
          content: '2024년 3월 ~ 2024년 12월',
        },
        {
          heading: '추진배경 및 목적',
          content:
            '1. 정부의 AI 활성화 정책에 따라 공공기관의 AI 신기술 도입 및 활용 촉진이 필요함\n2. AI 이용료 지원을 통해 기관 내 AI 기술 접근성을 높이고 업무 효율화를 추진함\n3. 생성형 AI(LLM) 및 기타 AI 기술의 실무 적용을 위한 체계적 지원 기반을 마련할 필요가 있음',
        },
        {
          heading: '추진내용',
          content:
            '1. AI 이용료 지원 계획 수립\n   - 지원 대상 AI 서비스 범위 설정 및 예산 배정\n   - ChatGPT, Claude 등 생성형 AI 서비스 지원 기준 마련\n2. 이용료 지원 시행\n   - 부서별 신청 접수 및 검토\n   - 월별 이용료 정산 및 지급 처리\n3. 활용 실태 모니터링\n   - 분기별 AI 활용 현황 조사 실시\n   - 업무 효율화 성과 측정 및 보고',
        },
        {
          heading: '추진성과 또는 기대효과',
          content:
            '1. AI 도구 활용을 통한 업무 생산성 향상\n   - 문서 작성 시간 평균 40% 단축\n   - AI 활용 직원 만족도 85% 달성\n2. 기관 내 AI 활용 역량 기반 마련\n   - AI 이용료 지원 체계 구축으로 지속적 활용 가능',
        },
        {
          heading: '향후계획',
          content:
            '2025년에는 지원 범위를 확대하여 더 많은 부서가 AI 도구를 활용할 수 있도록 예산을 증액하고, AI 활용 우수 사례를 기관 내 공유하는 체계를 마련할 예정임',
        },
      ],
    },
    {
      label: '실적 2',
      meta: [
        { label: '실적 번호', value: '실적 2' },
        { label: '증빙 파일', value: ['ChatGPT 유료 서비스 구독 보고.pdf'] },
      ],
      sections: [
        {
          heading: '추진실적명',
          content: 'ChatGPT 유료 서비스(ChatGPT Plus) 구독을 통한 AI 업무 활용',
        },
        {
          heading: '추진기간',
          content: '2024년 5월 ~ 2024년 12월',
        },
        {
          heading: '추진배경 및 목적',
          content:
            '1. 무료 버전의 속도 및 기능 제한으로 업무 활용에 한계가 있어 유료 구독 전환이 필요함\n2. GPT-4 모델 접근을 통한 고품질 문서 작성 및 분석 업무 지원이 목적임',
        },
        {
          heading: '추진내용',
          content:
            '1. ChatGPT Plus 구독 신청 및 승인\n2. 월별 이용료($20/월) 지원 처리\n3. 활용 지침 수립 및 부서 공유',
        },
        {
          heading: '추진성과 또는 기대효과',
          content:
            '1. 보고서 초안 작성 업무 효율 약 60% 향상\n2. 번역 및 외국어 자료 검토 업무 시간 대폭 절감',
        },
        {
          heading: '향후계획',
          content: '활용 현황을 분기별로 점검하고 유사 AI 도구로의 확장 여부를 검토할 예정임',
        },
      ],
    },
  ],
};

// ── 샘플 데이터: 단순 섹션 구조 ─────────────────────────────────────────────
const SAMPLE_SIMPLE: HwpDocumentData = {
  title: '공공데이터 활용도 제고 정성보고서',
  subtitle: '1-4-3 공공데이터 활용지원 | 한국학중앙연구원',
  date: '2025년 9월',
  sections: [
    {
      heading: '추진실적명',
      content: '2025년 한국학중앙연구원 개방데이터 수요조사',
    },
    {
      heading: '수행시기',
      content: '2025년 상반기 (2025년 3월 ~ 2025년 6월)',
    },
    {
      heading: '추진 필요성 및 배경',
      content:
        '1. 공공데이터의 효과적 개방 및 활용도 제고를 위해 수요자 중심의 데이터 개방 전략 수립이 필요함\n2. 기존 개방 데이터의 활용 현황을 파악하고, 신규 개방 수요를 체계적으로 발굴할 필요가 있음\n3. 데이터 수요조사를 통해 국민과 민간의 실질적 데이터 활용 수요를 반영한 개방 계획 수립이 요구됨',
    },
    {
      heading: '추진내용',
      content:
        '1. 수요조사 계획 수립 및 실시\n   - 한국학중앙연구원 개방데이터에 대한 외부 수요조사 실시\n   - 연구자, 민간 개발자, 일반 국민 등 다양한 수요자 대상 설문 진행\n2. 수요조사 결과 분석\n   - 수집된 응답 데이터를 분야별, 유형별로 분류 및 분석\n   - 개방 우선순위 도출 및 신규 개방 후보 데이터셋 선정\n3. 결과보고서 작성 및 개방 계획 반영',
    },
    {
      heading: '핵심성과',
      content:
        '1. 수요자 중심 데이터 개방 전략 수립 기반 마련\n   - 외부 수요조사를 통해 실질적 개방 수요를 파악함\n2. 개방데이터 활용도 제고를 위한 피드백 체계 구축\n   - 수요자의 의견을 반영한 데이터 품질 개선 방향을 확인함',
    },
  ],
};

// ── 컴포넌트 설명 카드 ──────────────────────────────────────────────────────
const COMPONENT_CARDS = [
  {
    icon: <Layout className="h-4 w-4" />,
    name: 'A4 용지 프레임',
    desc: '794×1123px (96dpi 기준 A4), 상30mm·좌30mm·우25mm·하25mm 여백, 용지 그림자',
    color: '#1A4496',
    bg: '#EEF3FF',
  },
  {
    icon: <Type className="h-4 w-4" />,
    name: '폰트 토글',
    desc: '맑은 고딕 (고딕체) ↔ 바탕체 (명조체) 실시간 전환, 툴바에서 선택',
    color: '#7B61FF',
    bg: '#F0ECFF',
  },
  {
    icon: <List className="h-4 w-4" />,
    name: '탭 (실적 구분)',
    desc: '복수 실적을 탭으로 전환, A4 문서 내에서는 섹션 분리로 표시',
    color: '#059669',
    bg: '#E6F9F3',
  },
  {
    icon: <Table2 className="h-4 w-4" />,
    name: '메타 정보 표',
    desc: '실적 번호, 증빙 파일 목록 등 키-값 형태의 HWP 스타일 표',
    color: '#FF6B00',
    bg: '#FFF3E8',
  },
  {
    icon: <AlignLeft className="h-4 w-4" />,
    name: '본문 섹션',
    desc: '제목(border-bottom 강조선) + 본문(10.5pt, 줄간격 1.8) 구조',
    color: '#3182f6',
    bg: '#E8F3FF',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    name: '인쇄 / 줌',
    desc: '75·100·125% 줌, 인쇄 버튼(새창 A4 레이아웃으로 브라우저 인쇄)',
    color: '#8B5CF6',
    bg: '#F5F3FF',
  },
];

// ── 페이지 ───────────────────────────────────────────────────────────────────
export default function HwpPreviewPage() {
  const [active, setActive] = useState<'tabs' | 'simple'>('tabs');

  const currentData = active === 'tabs' ? SAMPLE_TABS : SAMPLE_SIMPLE;

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: '#EEF3FF' }}>
            <FileText className="h-5 w-5" style={{ color: '#1A4496' }} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: '#191F28' }}>HWP 문서 미리보기 컴포넌트</h1>
            <p className="text-[13px]" style={{ color: '#8B95A1' }}>
              A4 용지 + HWP 스타일 — 각 프로젝트 결과물에 연결할 공유 컴포넌트
            </p>
          </div>
        </div>
      </div>

      {/* Component cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {COMPONENT_CARDS.map(c => (
          <div key={c.name} className="rounded-xl p-4" style={{ backgroundColor: '#fff', border: '1px solid #F0F1F4', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: c.bg, color: c.color }}>
                {c.icon}
              </div>
              <span className="text-[12.5px] font-bold" style={{ color: '#191F28' }}>{c.name}</span>
            </div>
            <p className="text-[11.5px] leading-relaxed" style={{ color: '#6B7684' }}>{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Sample selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[13px] font-semibold" style={{ color: '#4E5968' }}>샘플 데이터:</span>
        {[
          { id: 'tabs' as const, label: '탭 구조 (실적 1·2)' },
          { id: 'simple' as const, label: '단순 섹션 구조' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all"
            style={{
              backgroundColor: active === s.id ? '#1A4496' : '#F0F1F4',
              color: active === s.id ? '#fff' : '#4E5968',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* The actual component */}
      <HwpDocumentPreview
        data={currentData}
        title={currentData.title}
      />

      {/* Usage note */}
      <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: '#F8FAFB', border: '1px solid #E5E8EB' }}>
        <p className="text-[12.5px] font-bold mb-1" style={{ color: '#191F28' }}>프로젝트별 연결 방법</p>
        <p className="text-[12px] leading-relaxed" style={{ color: '#6B7684' }}>
          각 프로젝트 페이지의 결과(result) 데이터를 <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: '#F0F1F4', color: '#3182f6' }}>HwpDocumentData</code> 타입으로 매핑한 뒤{' '}
          <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: '#F0F1F4', color: '#3182f6' }}>{'<HwpDocumentPreview data={...} />'}</code>에 넘기면 됩니다.
          n8n이 HTML 문자열을 반환하는 경우 <code className="px-1 py-0.5 rounded text-[11px]" style={{ backgroundColor: '#F0F1F4', color: '#3182f6' }}>htmlContent</code> prop으로 바로 전달하면 HWP 스타일로 오버라이드됩니다.
        </p>
      </div>
    </div>
  );
}
