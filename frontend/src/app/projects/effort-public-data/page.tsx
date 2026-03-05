'use client';

import { useState, useRef } from 'react';
import { Upload, Play, Loader2, CheckCircle, XCircle, Download } from 'lucide-react';

type Status = 'idle' | 'uploading' | 'running' | 'completed' | 'failed';

export default function EffortPublicDataPage() {
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
        const res = await fetch(`/api/projects/effort-public-data/runs/${runId}`);
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

      const res = await fetch('/api/projects/effort-public-data/trigger/effort-public-data-main', {
        method: 'POST',
        body: formData,
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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">공유데이터 제공 노력</h1>

      {/* 파일 업로드 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          파일 선택
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <Upload className="h-4 w-4" />
            파일 찾기
          </button>
          <span className="text-sm text-gray-500">
            {file ? file.name : '선택된 파일 없음'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* 실행 버튼 */}
      <button
        onClick={handleTrigger}
        disabled={!file || status === 'uploading' || status === 'running'}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors mb-6"
      >
        {status === 'uploading' || status === 'running' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {status === 'uploading' ? '업로드 중...' :
         status === 'running' ? '실행 중...' : '실행'}
      </button>

      {/* 결과 */}
      {status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-800">완료</span>
          </div>
          {typeof result?.download_url === 'string' && (
            <a
              href={result.download_url as string}
              download
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
            >
              <Download className="h-4 w-4" />
              결과 파일 다운로드
            </a>
          )}
          {result && (
            <pre className="text-sm text-gray-700 bg-white rounded p-3 mt-2 overflow-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}

      {status === 'failed' && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="font-medium text-red-800">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
