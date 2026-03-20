'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Download,
  FileSpreadsheet,
  ScanSearch,
  FilterX,
  FileArchive,
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
    desc: '테이블/컬럼 정의서를 업로드합니다',
    color: '#3182f6',
    bg: '#e8f3ff',
  },
  {
    icon: ScanSearch,
    title: '패턴 분석',
    desc: '테이블명·컬럼 타입을 규칙 기반으로 분석합니다',
    color: '#FF6B00',
    bg: '#FFF3E8',
  },
  {
    icon: FilterX,
    title: '제외 판별',
    desc: '임시·백업·로그·뷰·시스템 테이블을 자동 분류합니다',
    color: '#7B61FF',
    bg: '#F0ECFF',
  },
  {
    icon: FileArchive,
    title: 'ZIP 다운로드',
    desc: '테이블/컬럼 관리 엑셀을 ZIP으로 제공합니다',
    color: '#00B386',
    bg: '#E6F9F3',
  },
];

export default function Test1Page() {
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
        const res = await fetch(`/api/projects/test1/runs/${runId}`, { credentials: 'include' });
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
      const res = await fetch('/api/projects/test1/trigger/test1-main', {
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: '#F0ECFF' }}>
            <FilterX className="h-5 w-5" style={{ color: '#7B61FF' }} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold leading-tight" style={{ color: '#191F28' }}>값진단 제외 대상 판별</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#8B95A1' }}>DB 테이블/컬럼 정의서를 분석하여 값진단 제외 대상을 자동 판별합니다</p>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F0F1F4' }}>
        <label className="block text-[14px] font-bold mb-3" style={{ color: '#191F28' }}>파일 업로드</label>
        <div
          className="rounded-xl p-7 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
          style={{ border: file ? '2px solid #7B61FF' : '2px dashed #B0B8C1', backgroundColor: file ? '#F8F5FF' : '#F8FAFB' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full transition-colors" style={{ backgroundColor: file ? '#F0ECFF' : '#F0F1F4' }}>
            {file ? <FileSpreadsheet className="h-5 w-5" style={{ color: '#7B61FF' }} /> : <Upload className="h-5 w-5" style={{ color: '#8B95A1' }} />}
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold" style={{ color: file ? '#191F28' : '#4E5968' }}>{file ? file.name : '클릭하여 엑셀 파일을 선택하세요'}</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: '#8B95A1' }}>{file ? `${(file.size / 1024).toFixed(1)} KB` : '.xlsx 형식 (테이블/컬럼 정의서)'}</p>
          </div>
          {file && <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: '#F0ECFF', color: '#7B61FF' }}>선택 완료</span>}
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
      </div>

      {/* Execute */}
      <button
        onClick={handleTrigger}
        disabled={!file || isRunning}
        className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl text-[14px] font-bold text-white transition-all mb-6"
        style={{ backgroundColor: '#7B61FF', opacity: !file || isRunning ? 0.45 : 1, cursor: !file || isRunning ? 'not-allowed' : 'pointer', boxShadow: file && !isRunning ? '0 4px 12px rgba(123, 97, 255, 0.3)' : 'none' }}
      >
        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {status === 'uploading' ? '업로드 중...' : status === 'running' ? '제외 대상을 판별하고 있습니다...' : '제외 대상 판별 실행'}
      </button>

      {/* Running */}
      {status === 'running' && (
        <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: '#FFFBF5', border: '1px solid #FFE4B8' }}>
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: '#FF8800' }} />
            <span className="text-[13px] font-bold" style={{ color: '#FF8800' }}>워크플로 실행 중</span>
          </div>
          <div className="space-y-1 pl-7">
            {['엑셀 파일에서 테이블/컬럼 메타데이터 추출 중...', '패턴 매칭으로 제외 대상 판별 중...', '결과 엑셀 생성 및 ZIP 압축 중...'].map((s, i) => (
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
              <span className="text-[14px] font-bold" style={{ color: '#00B386' }}>판별 완료</span>
            </div>
            {typeof result?.download_url === 'string' && (
              <a href={result.download_url as string} download className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold text-white transition-all hover:opacity-90" style={{ backgroundColor: '#7B61FF', boxShadow: '0 2px 8px rgba(123,97,255,0.25)' }}>
                <Download className="h-4 w-4" />ZIP 다운로드
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

      {/* Divider */}
      <div className="h-px mb-6" style={{ backgroundColor: '#E5E8EB' }} />

      {/* Description */}
      <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: '#F8FAFB', border: '1px solid #E5E8EB' }}>
        <h2 className="text-[15px] font-bold mb-3" style={{ color: '#191F28' }}>이 서비스는 무엇인가요?</h2>
        <p className="text-[13.5px] leading-relaxed" style={{ color: '#4E5968' }}>
          DB 테이블/컬럼 정의서(엑셀)를 업로드하면, <strong style={{ color: '#191F28' }}>규칙 기반으로 WDQ 값진단 제외 대상을 자동 판별</strong>합니다.
          임시·백업·로그·뷰·시스템 테이블과 DATE/BLOB/CLOB 등 진단 불필요 컬럼을 자동 분류하여, 테이블 관리 엑셀과 컬럼 관리 엑셀을 ZIP으로 제공합니다.
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
            <Info className="h-4 w-4" style={{ color: '#7B61FF' }} />
            <span className="text-[14px] font-bold" style={{ color: '#191F28' }}>상세 안내사항</span>
          </div>
          <span className="text-[12px] font-medium" style={{ color: '#8B95A1' }}>{showGuide ? '접기' : '펼치기'}</span>
        </button>
        {showGuide && (
          <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #F0F1F4' }}>
            <div className="pt-4">
              <h3 className="text-[13px] font-bold mb-2 flex items-center gap-1.5" style={{ color: '#191F28' }}>
                <FilterX className="h-3.5 w-3.5" style={{ color: '#7B61FF' }} />제외 판별 규칙
              </h3>
              <div className="rounded-lg p-3.5 space-y-1.5" style={{ backgroundColor: '#F8FAFB' }}>
                {['임시/테스트 테이블 (_TEMP, _TEST 등)', '백업 테이블 (_BAK, _OLD, _ORG, 날짜8자리 접미)', '로그/이력 테이블 (_LOG, _HIST, _AUDIT)', '뷰 (_VIEW, _VW, VW_ 접두)', '시스템 관리 테이블 (SYS_, DBA_, META_, ADMIN_)', '컬럼: DATE, TIMESTAMP, CLOB, BLOB, LONG 타입', '컬럼: 데이터 길이 > 100'].map((item) => (
                  <p key={item} className="text-[12.5px] flex items-start gap-2" style={{ color: '#4E5968' }}>
                    <span style={{ color: '#7B61FF' }}>&#10003;</span>{item}
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
                <p className="text-[12px]" style={{ color: '#4E5968' }}>파일당 수초 ~ 1분 (AI 미사용, 규칙 기반)</p>
              </div>
              <div className="flex-1 rounded-lg p-3.5" style={{ backgroundColor: '#F8FAFB' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#F04452' }} />
                  <span className="text-[12px] font-bold" style={{ color: '#191F28' }}>출력 형식</span>
                </div>
                <p className="text-[12px]" style={{ color: '#4E5968' }}>테이블 관리 + 컬럼 관리 엑셀 → ZIP</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
