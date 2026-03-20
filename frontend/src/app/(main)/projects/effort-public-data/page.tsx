'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  FileText,
  BrainCircuit,
  ScanSearch,
  FileOutput,
  ArrowRight,
  Info,
  Clock,
  AlertTriangle,
  Database,
} from 'lucide-react';

type Status = 'idle' | 'uploading' | 'running' | 'completed' | 'failed';

const STEPS = [
  { icon: FileText, title: 'PDF 업로드', desc: '기존 정성보고서 PDF를 업로드합니다', color: '#3182f6', bg: '#e8f3ff' },
  { icon: ScanSearch, title: '구조 추출', desc: 'AI가 PDF에서 섹션별 내용을 구조화합니다', color: '#FF6B00', bg: '#FFF3E8' },
  { icon: BrainCircuit, title: 'AI 생성/검증', desc: '보고서 생성 → 점수 평가 → 재작성 루프', color: '#7B61FF', bg: '#F0ECFF' },
  { icon: FileOutput, title: 'HTML 보고서', desc: '점수 통과 시 최종 보고서를 HTML로 제공합니다', color: '#00B386', bg: '#E6F9F3' },
];

export default function EffortPublicDataPage() {
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
        const res = await fetch(`/api/projects/effort-public-data/runs/${runId}`, { credentials: 'include' });
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
      } catch {}
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
      const res = await fetch('/api/projects/effort-public-data/trigger/effort-public-data-main', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `요청 실패: ${res.status}`);
      }
      const data = await res.json();
      setStatus('running');
      pollStatus(data.data?.run_id);
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  };

  const isRunning = status === 'uploading' || status === 'running';

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: '#e8f3ff' }}>
            <Database className="h-5 w-5" style={{ color: '#3182f6' }} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold leading-tight" style={{ color: '#191F28' }}>공유데이터 제공 노력</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#8B95A1' }}>공유데이터 제공 노력 정성보고서를 AI가 자동 생성하고 점수 평가합니다</p>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F0F1F4' }}>
        <label className="block text-[14px] font-bold mb-3" style={{ color: '#191F28' }}>파일 업로드</label>
        <div
          className="rounded-xl p-7 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
          style={{ border: file ? '2px solid #3182f6' : '2px dashed #B0B8C1', backgroundColor: file ? '#F5F9FF' : '#F8FAFB' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full transition-colors" style={{ backgroundColor: file ? '#e8f3ff' : '#F0F1F4' }}>
            {file ? <FileText className="h-5 w-5" style={{ color: '#3182f6' }} /> : <Upload className="h-5 w-5" style={{ color: '#8B95A1' }} />}
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold" style={{ color: file ? '#191F28' : '#4E5968' }}>{file ? file.name : '클릭하여 정성보고서 PDF를 선택하세요'}</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: '#8B95A1' }}>{file ? `${(file.size / 1024).toFixed(1)} KB` : '.pdf 형식'}</p>
          </div>
          {file && <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: '#e8f3ff', color: '#3182f6' }}>선택 완료</span>}
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
      </div>

      {/* Execute */}
      <button onClick={handleTrigger} disabled={!file || isRunning}
        className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl text-[14px] font-bold text-white transition-all mb-6"
        style={{ backgroundColor: '#3182f6', opacity: !file || isRunning ? 0.45 : 1, cursor: !file || isRunning ? 'not-allowed' : 'pointer', boxShadow: file && !isRunning ? '0 4px 12px rgba(49,130,246,0.3)' : 'none' }}
      >
        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {status === 'uploading' ? '업로드 중...' : status === 'running' ? 'AI가 보고서를 생성/평가하고 있습니다...' : '보고서 생성 실행'}
      </button>

      {/* Running */}
      {status === 'running' && (
        <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: '#FFFBF5', border: '1px solid #FFE4B8' }}>
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: '#FF8800' }} />
            <span className="text-[13px] font-bold" style={{ color: '#FF8800' }}>워크플로 실행 중</span>
          </div>
          <div className="space-y-1 pl-7">
            {['PDF에서 섹션별 텍스트 구조화 중...', '입력 자료 적정성 1차 검증 중...', 'AI가 보고서 요약/생성 중...', '점수 평가 및 품질 검증 중 (최대 3회 반복)...'].map((s, i) => (
              <p key={i} className="text-[12px] flex items-center gap-2" style={{ color: '#B8860B' }}>
                <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#FFD591' }} />{s}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {status === 'completed' && (
        <div className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E5E8EB' }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#E6F9F3' }}>
                <CheckCircle className="h-4 w-4" style={{ color: '#00B386' }} />
              </div>
              <span className="text-[14px] font-bold" style={{ color: '#00B386' }}>생성 완료</span>
            </div>
            {typeof result?.download_url === 'string' && (
              <a href={result.download_url as string} download className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-all hover:opacity-90" style={{ backgroundColor: '#3182f6', boxShadow: '0 2px 8px rgba(49,130,246,0.25)' }}>
                <Download className="h-4 w-4" />보고서 다운로드
              </a>
            )}
          </div>
          <div className="p-5">
            {result && <pre className="text-[11px] font-mono rounded-xl p-4 overflow-auto max-h-64 leading-relaxed" style={{ backgroundColor: '#F8FAFB', color: '#4E5968', border: '1px solid #F0F1F4' }}>{JSON.stringify(result, null, 2)}</pre>}
          </div>
        </div>
      )}

      {/* Failed */}
      {status === 'failed' && error && (
        <div className="flex items-start gap-3 rounded-xl px-5 py-4 mb-6" style={{ backgroundColor: '#FFF5F5', border: '1px solid #FFD4D4' }}>
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#F04452' }} />
          <div>
            <p className="text-[13px] font-bold mb-1" style={{ color: '#F04452' }}>실행 실패</p>
            <p className="text-[12.5px]" style={{ color: '#D32F2F' }}>{error}</p>
          </div>
        </div>
      )}

      <div className="h-px mb-6" style={{ backgroundColor: '#E5E8EB' }} />

      {/* Description */}
      <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: '#F8FAFB', border: '1px solid #E5E8EB' }}>
        <h2 className="text-[15px] font-bold mb-3" style={{ color: '#191F28' }}>이 서비스는 무엇인가요?</h2>
        <p className="text-[13.5px] leading-relaxed" style={{ color: '#4E5968' }}>
          공유데이터 제공 노력 관련 정성보고서 PDF를 업로드하면, <strong style={{ color: '#191F28' }}>AI가 배경·목적, 데이터 설명, 발굴·제공 과정, 활용사례, 기대효과 등 6개 섹션으로 구조화하여 보고서를 자동 생성</strong>합니다.
          60점 만점 기준으로 점수 평가를 거치며, 미달 시 최대 3회 자동 재작성합니다.
        </p>
      </div>

      {/* Steps */}
      <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F0F1F4' }}>
        <h2 className="text-[15px] font-bold mb-4" style={{ color: '#191F28' }}>작동 방식</h2>
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl mb-2.5" style={{ backgroundColor: step.bg }}>
                <step.icon className="h-5 w-5" style={{ color: step.color }} />
              </div>
              <p className="text-[12.5px] font-semibold leading-tight mb-1" style={{ color: '#191F28' }}>{step.title}</p>
              <p className="text-[11px] leading-snug" style={{ color: '#8B95A1' }}>{step.desc}</p>
              {i < STEPS.length - 1 && <ArrowRight className="absolute -right-2.5 top-3 h-3.5 w-3.5" style={{ color: '#D1D6DB' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Guide */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F0F1F4' }}>
        <button onClick={() => setShowGuide(!showGuide)} className="flex items-center justify-between w-full px-5 py-4 text-left">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" style={{ color: '#3182f6' }} />
            <span className="text-[14px] font-bold" style={{ color: '#191F28' }}>상세 안내사항</span>
          </div>
          <span className="text-[12px] font-medium" style={{ color: '#8B95A1' }}>{showGuide ? '접기' : '펼치기'}</span>
        </button>
        {showGuide && (
          <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #F0F1F4' }}>
            <div className="pt-4">
              <h3 className="text-[13px] font-bold mb-2 flex items-center gap-1.5" style={{ color: '#191F28' }}>
                <CheckCircle className="h-3.5 w-3.5" style={{ color: '#00B386' }} />보고서 6개 섹션
              </h3>
              <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F8FAFB' }}>
                <div className="flex flex-wrap gap-1.5">
                  {['1.1 배경 및 목적', '1.2 공유데이터 설명', '2.1 공유데이터 발굴', '2.2 공유데이터 제공', '3.1 제공데이터 활용사례', '3.2 기대효과 및 계획'].map((col) => (
                    <span key={col} className="inline-flex items-center rounded-md px-2.5 py-1 text-[11.5px] font-semibold" style={{ backgroundColor: '#e8f3ff', color: '#3182f6' }}>{col}</span>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-[13px] font-bold mb-2 flex items-center gap-1.5" style={{ color: '#191F28' }}>
                <BrainCircuit className="h-3.5 w-3.5" style={{ color: '#7B61FF' }} />점수 평가 체계
              </h3>
              <div className="rounded-lg p-3.5 space-y-1.5" style={{ backgroundColor: '#F8FAFB' }}>
                {['60점 만점 기준 섹션별 점수 평가', '미달 섹션은 피드백 기반 자동 재작성', '최대 3회 반복 후 최종 결과 확정', '기존 데이터만 활용 (SUMMARIZE_ONLY), 허위 생성 금지'].map((item) => (
                  <p key={item} className="text-[12.5px] flex items-start gap-2" style={{ color: '#4E5968' }}>
                    <span style={{ color: '#00B386' }}>&#10003;</span>{item}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg p-3.5" style={{ backgroundColor: '#F8FAFB' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="h-3.5 w-3.5" style={{ color: '#FF8800' }} />
                  <span className="text-[12px] font-bold" style={{ color: '#191F28' }}>예상 소요 시간</span>
                </div>
                <p className="text-[12px]" style={{ color: '#4E5968' }}>보고서 1건당 약 3~10분 소요</p>
              </div>
              <div className="flex-1 rounded-lg p-3.5" style={{ backgroundColor: '#F8FAFB' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#F04452' }} />
                  <span className="text-[12px] font-bold" style={{ color: '#191F28' }}>유의사항</span>
                </div>
                <p className="text-[12px]" style={{ color: '#4E5968' }}>원문 PDF 품질이 결과에 직접 영향</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
