'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  Search,
  FileSpreadsheet,
  BrainCircuit,
  ArrowRight,
  Info,
  Clock,
  AlertTriangle,
} from 'lucide-react';

type Status = 'idle' | 'uploading' | 'running' | 'completed' | 'failed';

const STEPS = [
  {
    icon: FileSpreadsheet,
    title: '엑셀 업로드',
    desc: '기관 정보가 담긴 파일을 업로드합니다',
    color: '#3182f6',
    bg: '#e8f3ff',
  },
  {
    icon: Search,
    title: '뉴스 검색',
    desc: 'SerpAPI로 구글 뉴스를 자동 검색합니다',
    color: '#FF6B00',
    bg: '#FFF3E8',
  },
  {
    icon: BrainCircuit,
    title: 'AI 필터링',
    desc: 'Gemini가 우수사례 기준에 맞는 결과만 선별합니다',
    color: '#7B61FF',
    bg: '#F0ECFF',
  },
  {
    icon: Download,
    title: '결과 다운로드',
    desc: '선별된 우수사례를 엑셀로 다운로드합니다',
    color: '#00B386',
    bg: '#E6F9F3',
  },
];

export default function BestPracticeSearchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  const pollStatus = (runId: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/projects/best-practice-search/runs/${runId}`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'completed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setStatus('completed');
          setResult(data.result_data);
        } else if (data.status === 'failed') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setStatus('failed');
          setError(data.error_message || '실행 실패');
        }
      } catch {
        // polling 에러는 무시
      }
    }, 3000);
  };

  const handleTrigger = async () => {
    if (!file) return;

    setStatus('uploading');
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        '/api/projects/best-practice-search/trigger/best-practice-search-main',
        {
          method: 'POST',
          body: formData,
          credentials: 'include',
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `요청 실패: ${res.status}`);
      }

      const data = await res.json();
      const runId = data.data?.run_id;

      setStatus('running');
      pollStatus(runId);
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  };

  const isRunning = status === 'uploading' || status === 'running';

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: '#e8f3ff' }}
          >
            <Search className="h-5 w-5" style={{ color: '#3182f6' }} />
          </div>
          <div>
            <h1
              className="text-[22px] font-bold leading-tight"
              style={{ color: '#191F28' }}
            >
              민간 활용 우수사례 검색
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#8B95A1' }}>
              공공데이터 민간 활용 우수사례를 AI로 자동 검색하고 선별합니다
            </p>
          </div>
        </div>
      </div>

      {/* ── File Upload ── */}
      <div
        className="rounded-2xl p-5 mb-4"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: '1px solid #F0F1F4',
        }}
      >
        <label
          className="block text-[14px] font-bold mb-3"
          style={{ color: '#191F28' }}
        >
          파일 업로드
        </label>

        <div
          className="rounded-xl p-7 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
          style={{
            border: file ? '2px solid #3182f6' : '2px dashed #B0B8C1',
            backgroundColor: file ? '#F5F9FF' : '#F8FAFB',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full transition-colors"
            style={{
              backgroundColor: file ? '#e8f3ff' : '#F0F1F4',
            }}
          >
            {file ? (
              <FileSpreadsheet
                className="h-5 w-5"
                style={{ color: '#3182f6' }}
              />
            ) : (
              <Upload className="h-5 w-5" style={{ color: '#8B95A1' }} />
            )}
          </div>
          <div className="text-center">
            <p
              className="text-[13px] font-semibold"
              style={{ color: file ? '#191F28' : '#4E5968' }}
            >
              {file ? file.name : '클릭하여 엑셀 파일을 선택하세요'}
            </p>
            <p
              className="text-[11.5px] mt-0.5"
              style={{ color: '#8B95A1' }}
            >
              {file
                ? `${(file.size / 1024).toFixed(1)} KB`
                : '.xlsx, .xls, .csv 형식 지원'}
            </p>
          </div>
          {file && (
            <span
              className="text-[11px] px-2.5 py-1 rounded-full font-semibold"
              style={{ backgroundColor: '#e8f3ff', color: '#3182f6' }}
            >
              선택 완료
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* ── Execute Button ── */}
      <button
        onClick={handleTrigger}
        disabled={!file || isRunning}
        className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl text-[14px] font-bold text-white transition-all mb-6"
        style={{
          backgroundColor: '#3182f6',
          opacity: !file || isRunning ? 0.45 : 1,
          cursor: !file || isRunning ? 'not-allowed' : 'pointer',
          boxShadow:
            file && !isRunning
              ? '0 4px 12px rgba(49, 130, 246, 0.3)'
              : 'none',
        }}
      >
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {status === 'uploading'
          ? '업로드 중...'
          : status === 'running'
            ? 'AI가 우수사례를 검색하고 있습니다...'
            : '우수사례 검색 실행'}
      </button>

      {/* ── Running Status ── */}
      {status === 'running' && (
        <div
          className="rounded-xl px-5 py-4 mb-5"
          style={{
            backgroundColor: '#FFFBF5',
            border: '1px solid #FFE4B8',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Loader2
              className="h-4 w-4 animate-spin flex-shrink-0"
              style={{ color: '#FF8800' }}
            />
            <span
              className="text-[13px] font-bold"
              style={{ color: '#FF8800' }}
            >
              워크플로 실행 중
            </span>
          </div>
          <div className="space-y-1 pl-7">
            {[
              'SerpAPI로 구글 뉴스 검색 중...',
              '검색 결과 중복 제거 중...',
              'AI Agent가 우수사례를 분석/선별 중...',
            ].map((step, i) => (
              <p
                key={i}
                className="text-[12px] flex items-center gap-2"
                style={{ color: '#B8860B' }}
              >
                <span
                  className="h-1 w-1 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#FFD591' }}
                />
                {step}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Completed ── */}
      {status === 'completed' && (
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid #E5E8EB' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0"
                style={{ backgroundColor: '#E6F9F3' }}
              >
                <CheckCircle
                  className="h-4 w-4"
                  style={{ color: '#00B386' }}
                />
              </div>
              <span
                className="text-[14px] font-bold"
                style={{ color: '#00B386' }}
              >
                검색 완료
              </span>
            </div>
            {typeof result?.download_url === 'string' && (
              <a
                href={result.download_url as string}
                download
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-all hover:opacity-90"
                style={{
                  backgroundColor: '#3182f6',
                  boxShadow: '0 2px 8px rgba(49, 130, 246, 0.25)',
                }}
              >
                <Download className="h-4 w-4" />
                엑셀 다운로드
              </a>
            )}
          </div>

          <div className="p-5">
            {result && (
              <pre
                className="text-[11px] font-mono rounded-xl p-4 overflow-auto max-h-64 leading-relaxed"
                style={{
                  backgroundColor: '#F8FAFB',
                  color: '#4E5968',
                  border: '1px solid #F0F1F4',
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
            {!result && (
              <p
                className="text-[13px]"
                style={{ color: '#8B95A1' }}
              >
                결과 데이터가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Failed ── */}
      {status === 'failed' && error && (
        <div
          className="flex items-start gap-3 rounded-xl px-5 py-4 mb-6"
          style={{
            backgroundColor: '#FFF5F5',
            border: '1px solid #FFD4D4',
          }}
        >
          <XCircle
            className="h-4 w-4 flex-shrink-0 mt-0.5"
            style={{ color: '#F04452' }}
          />
          <div>
            <p
              className="text-[13px] font-bold mb-1"
              style={{ color: '#F04452' }}
            >
              실행 실패
            </p>
            <p className="text-[12.5px]" style={{ color: '#D32F2F' }}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      <div
        className="h-px mb-6"
        style={{ backgroundColor: '#E5E8EB' }}
      />

      {/* ── Service Description ── */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{
          backgroundColor: '#F8FAFB',
          border: '1px solid #E5E8EB',
        }}
      >
        <h2
          className="text-[15px] font-bold mb-3"
          style={{ color: '#191F28' }}
        >
          이 서비스는 무엇인가요?
        </h2>
        <p
          className="text-[13.5px] leading-relaxed"
          style={{ color: '#4E5968' }}
        >
          기관명과 검색어가 포함된 엑셀 파일을 업로드하면,{' '}
          <strong style={{ color: '#191F28' }}>
            구글 뉴스에서 해당 기관의 공공데이터를 민간에서 활용한 사례
          </strong>
          를 자동으로 검색합니다. AI가 검색 결과를 분석하여 공공데이터 개방
          평가 기준에 부합하는 우수사례(앱/웹 서비스, 특허, 논문)만 선별하고,
          결과를 엑셀 파일로 제공합니다.
        </p>
      </div>

      {/* ── How it works ── */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: '1px solid #F0F1F4',
        }}
      >
        <h2
          className="text-[15px] font-bold mb-4"
          style={{ color: '#191F28' }}
        >
          작동 방식
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl mb-2.5"
                style={{ backgroundColor: step.bg }}
              >
                <step.icon className="h-5 w-5" style={{ color: step.color }} />
              </div>
              <p
                className="text-[12.5px] font-semibold leading-tight mb-1"
                style={{ color: '#191F28' }}
              >
                {step.title}
              </p>
              <p
                className="text-[11px] leading-snug"
                style={{ color: '#8B95A1' }}
              >
                {step.desc}
              </p>
              {i < STEPS.length - 1 && (
                <ArrowRight
                  className="absolute -right-2.5 top-3 h-3.5 w-3.5"
                  style={{ color: '#D1D6DB' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Guide (collapsible) ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          border: '1px solid #F0F1F4',
        }}
      >
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-between w-full px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" style={{ color: '#3182f6' }} />
            <span
              className="text-[14px] font-bold"
              style={{ color: '#191F28' }}
            >
              상세 안내사항
            </span>
          </div>
          <span
            className="text-[12px] font-medium"
            style={{ color: '#8B95A1' }}
          >
            {showGuide ? '접기' : '펼치기'}
          </span>
        </button>

        {showGuide && (
          <div
            className="px-5 pb-5 space-y-4"
            style={{ borderTop: '1px solid #F0F1F4' }}
          >
            {/* File format */}
            <div className="pt-4">
              <h3
                className="text-[13px] font-bold mb-2 flex items-center gap-1.5"
                style={{ color: '#191F28' }}
              >
                <FileSpreadsheet
                  className="h-3.5 w-3.5"
                  style={{ color: '#3182f6' }}
                />
                업로드 파일 형식
              </h3>
              <div
                className="rounded-lg p-3.5"
                style={{ backgroundColor: '#F8FAFB' }}
              >
                <p
                  className="text-[12.5px] leading-relaxed mb-2"
                  style={{ color: '#4E5968' }}
                >
                  엑셀 파일에 다음 컬럼이 포함되어야 합니다:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '기관명',
                    '기관 홈페이지 URL',
                    '검색어',
                    'SerpAPI 키',
                  ].map((col) => (
                    <span
                      key={col}
                      className="inline-flex items-center rounded-md px-2.5 py-1 text-[11.5px] font-semibold"
                      style={{
                        backgroundColor: '#e8f3ff',
                        color: '#3182f6',
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Evaluation criteria */}
            <div>
              <h3
                className="text-[13px] font-bold mb-2 flex items-center gap-1.5"
                style={{ color: '#191F28' }}
              >
                <CheckCircle
                  className="h-3.5 w-3.5"
                  style={{ color: '#00B386' }}
                />
                AI 선별 기준
              </h3>
              <div
                className="rounded-lg p-3.5 space-y-1.5"
                style={{ backgroundColor: '#F8FAFB' }}
              >
                {[
                  '민간 또는 타기관이 해당 기관의 데이터를 활용한 사례',
                  '앱/웹 서비스 개발, 특허 출원/등록, 논문 승인/출판',
                  '해당 기관이 데이터 제공 등 지원 노력이 있는 경우',
                  '기관 자체 사례는 제외 (외부 활용만 인정)',
                ].map((item) => (
                  <p
                    key={item}
                    className="text-[12.5px] flex items-start gap-2"
                    style={{ color: '#4E5968' }}
                  >
                    <span style={{ color: '#00B386' }}>&#10003;</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>

            {/* Time & limits */}
            <div className="flex gap-3">
              <div
                className="flex-1 rounded-lg p-3.5"
                style={{ backgroundColor: '#F8FAFB' }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock
                    className="h-3.5 w-3.5"
                    style={{ color: '#FF8800' }}
                  />
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: '#191F28' }}
                  >
                    예상 소요 시간
                  </span>
                </div>
                <p
                  className="text-[12px]"
                  style={{ color: '#4E5968' }}
                >
                  기관 1개당 약 1~3분 소요
                </p>
              </div>
              <div
                className="flex-1 rounded-lg p-3.5"
                style={{ backgroundColor: '#F8FAFB' }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle
                    className="h-3.5 w-3.5"
                    style={{ color: '#F04452' }}
                  />
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: '#191F28' }}
                  >
                    유의사항
                  </span>
                </div>
                <p
                  className="text-[12px]"
                  style={{ color: '#4E5968' }}
                >
                  SerpAPI 무료 계정은 월 100건 제한
                </p>
              </div>
            </div>

            {/* Output format */}
            <div>
              <h3
                className="text-[13px] font-bold mb-2 flex items-center gap-1.5"
                style={{ color: '#191F28' }}
              >
                <Download
                  className="h-3.5 w-3.5"
                  style={{ color: '#7B61FF' }}
                />
                결과 파일 항목
              </h3>
              <div
                className="rounded-lg p-3.5"
                style={{ backgroundColor: '#F8FAFB' }}
              >
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '우수사례명',
                    '우수사례 내용',
                    '활용 데이터',
                    '기관 지원 노력',
                    '사례 유형',
                    '날짜',
                    '출처 URL',
                  ].map((col) => (
                    <span
                      key={col}
                      className="inline-flex items-center rounded-md px-2.5 py-1 text-[11.5px] font-medium"
                      style={{
                        backgroundColor: '#F0ECFF',
                        color: '#7B61FF',
                      }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
