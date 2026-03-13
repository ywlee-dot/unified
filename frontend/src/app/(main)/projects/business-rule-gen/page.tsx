'use client';

import { useState, useRef } from 'react';
import { Upload, Play, Loader2, CheckCircle, XCircle, Download, GitMerge } from 'lucide-react';

type Status = 'idle' | 'uploading' | 'running' | 'completed' | 'failed';

export default function BusinessRuleGenPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
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
        const res = await fetch(`/api/projects/business-rule-gen/runs/${runId}`, { credentials: 'include' });
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

      const res = await fetch('/api/projects/business-rule-gen/trigger/business-rule-gen-main', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

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
    <div className="p-6 max-w-2xl">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: '#f3f0ff' }}
          >
            <GitMerge className="h-4 w-4" style={{ color: '#8B5CF6' }} />
          </div>
          <h1 className="text-[22px] font-bold leading-tight" style={{ color: '#191F28' }}>
            업무규칙 자동 생성
          </h1>
        </div>
        <p className="mt-1 text-sm" style={{ color: '#8B95A1' }}>
          업무 문서를 업로드하고 규칙 생성 워크플로를 실행하세요
        </p>
      </div>

      {/* File Upload Card */}
      <div
        className="rounded-2xl p-6 mb-4"
        style={{
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <label className="block text-sm font-semibold mb-3" style={{ color: '#191F28' }}>
          파일 선택
        </label>

        <div
          className="rounded-[10px] p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
          style={{
            border: '2px dashed #B0B8C1',
            backgroundColor: '#F4F5F8',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: '#f3f0ff' }}
          >
            <Upload className="h-5 w-5" style={{ color: '#8B5CF6' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: '#4E5968' }}>
              {file ? file.name : '파일을 클릭하여 선택'}
            </p>
            {!file && (
              <p className="text-xs mt-0.5" style={{ color: '#8B95A1' }}>
                모든 파일 형식 지원
              </p>
            )}
          </div>
          {file && (
            <span
              className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: '#f3f0ff', color: '#8B5CF6' }}
            >
              선택됨
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Execute Button */}
      <button
        onClick={handleTrigger}
        disabled={!file || isRunning}
        className="flex items-center justify-center gap-2 w-full h-10 rounded-[10px] text-sm font-semibold text-white transition-opacity mb-6"
        style={{
          backgroundColor: '#8B5CF6',
          opacity: !file || isRunning ? 0.5 : 1,
          cursor: !file || isRunning ? 'not-allowed' : 'pointer',
        }}
      >
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {status === 'uploading' ? '업로드 중...' :
         status === 'running' ? '실행 중...' : '실행'}
      </button>

      {/* Running status */}
      {status === 'running' && (
        <div
          className="flex items-center gap-3 rounded-[10px] px-4 py-3 mb-4"
          style={{ backgroundColor: '#FFF5E6', border: '1px solid #FFD591' }}
        >
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: '#FF8800' }} />
          <span className="text-sm font-medium" style={{ color: '#FF8800' }}>
            워크플로 실행 중...
          </span>
        </div>
      )}

      {/* Completed Result */}
      {status === 'completed' && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="flex items-center gap-2.5 px-5 py-4"
            style={{ borderBottom: '1px solid #E5E8EB' }}
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0"
              style={{ backgroundColor: '#E6F9F3' }}
            >
              <CheckCircle className="h-3.5 w-3.5" style={{ color: '#00B386' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#00B386' }}>
              완료
            </span>
          </div>

          <div className="p-5 space-y-3">
            {typeof result?.download_url === 'string' && (
              <a
                href={result.download_url as string}
                download
                className="inline-flex items-center gap-2 text-sm font-medium underline-offset-2 hover:underline transition-all"
                style={{ color: '#8B5CF6' }}
              >
                <Download className="h-4 w-4" />
                결과 파일 다운로드
              </a>
            )}
            {result && (
              <pre
                className="text-xs font-mono rounded-[10px] p-4 overflow-auto max-h-64 leading-relaxed"
                style={{
                  backgroundColor: '#F0F1F4',
                  color: '#4E5968',
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Failed Result */}
      {status === 'failed' && error && (
        <div
          className="flex items-start gap-3 rounded-[10px] px-4 py-3"
          style={{ backgroundColor: '#FFF0F1', border: '1px solid #FFBFC3' }}
        >
          <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#F04452' }} />
          <span className="text-sm font-medium" style={{ color: '#F04452' }}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
