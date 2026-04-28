'use client';

import { useState, useMemo, useCallback } from 'react';
import { Printer, FileText, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type FontType = 'gothic' | 'myeongjo' | 'humanmyeongjo';
type ZoomLevel = 75 | 100 | 125;

export interface HwpTableCell {
  value: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  bg?: string;
  rowspan?: number;
  colspan?: number;
}

export interface HwpTable {
  headers?: (string | HwpTableCell)[];
  rows: (string | HwpTableCell)[][];
  columnWidths?: (string | number)[];
  caption?: string;
}

export interface HwpSection {
  heading: string;
  content?: string;
  table?: HwpTable;
}

export interface HwpTabData {
  label: string;
  meta?: { label: string; value: string | string[] }[];
  sections: HwpSection[];
}

export interface HwpDocumentData {
  title: string;
  subtitle?: string;
  organization?: string;
  date?: string;
  sections?: HwpSection[];
  tabs?: HwpTabData[];
}

interface Props {
  /** Raw HTML from n8n → rendered in A4 iframe with HWP CSS override */
  htmlContent?: string;
  /** Structured JSON → rendered with React HWP components */
  data?: HwpDocumentData;
  title?: string;
  className?: string;
  onClose?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FONTS: Record<FontType, string> = {
  gothic:   "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', 'Nanum Gothic', sans-serif",
  myeongjo: "'Batang', '바탕체', 'UnBatang', 'Noto Serif KR', Georgia, serif",
  humanmyeongjo: "'휴먼명조', 'HumanMyeongjo', 'HY신명조', 'HYSinMyeongJo', 'Batang', '바탕', 'Noto Serif KR', serif",
};
const FONT_LABELS: Record<FontType, string> = { gothic: '맑은 고딕', myeongjo: '바탕체', humanmyeongjo: '휴먼명조' };

const A4_W = 794;   // 210mm at 96 dpi
const A4_H = 1123;  // 297mm at 96 dpi
const PAD  = { top: 113, right: 94, bottom: 94, left: 113 }; // 30/25/25/30mm

// ── HWP Override CSS (injected into iframe) ───────────────────────────────

function buildHwpCss(fontFamily: string): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${fontFamily};
      font-size: 10.5pt;
      line-height: 1.8;
      color: #000;
      background: #fff;
      padding: ${PAD.top}px ${PAD.right}px ${PAD.bottom}px ${PAD.left}px;
    }
    /* Reset web-app container */
    .container {
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
    }
    /* Document header */
    .header {
      text-align: center !important;
      margin-bottom: 18pt !important;
      padding-bottom: 10pt !important;
      border: none !important;
      border-bottom: 2pt solid #000 !important;
      background: transparent !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    .header h1 {
      font-size: 16pt !important;
      font-weight: 700 !important;
      color: #000 !important;
    }
    .header p { font-size: 10pt !important; color: #444 !important; margin-top: 4pt !important; }
    /* Hide tab buttons — document shows all sections sequentially */
    .tabs { display: none !important; }
    /* All tab panels visible */
    .tab-panel { display: block !important; }
    .tab-panel + .tab-panel {
      border-top: 1pt solid #ccc;
      margin-top: 22pt;
      padding-top: 22pt;
    }
    /* Meta info box */
    .report-meta {
      background: #f5f5f5 !important;
      border: 0.5pt solid #999 !important;
      border-radius: 0 !important;
      padding: 6pt 10pt !important;
      margin-bottom: 12pt !important;
      box-shadow: none !important;
    }
    .meta-row {
      display: flex !important;
      align-items: flex-start !important;
      padding: 3pt 0 !important;
      border-bottom: 0.5pt solid #e0e0e0 !important;
    }
    .meta-row:last-child { border-bottom: none !important; }
    .meta-label {
      font-weight: 700 !important;
      font-size: 9pt !important;
      color: #000 !important;
      width: 80pt !important;
      flex-shrink: 0 !important;
    }
    .meta-value { font-size: 9pt !important; color: #000 !important; }
    .file-tag {
      display: inline-block !important;
      border: 0.5pt solid #888 !important;
      background: transparent !important;
      color: #000 !important;
      border-radius: 2pt !important;
      padding: 1pt 5pt !important;
      font-size: 8.5pt !important;
      margin: 1pt 2pt 1pt 0 !important;
    }
    /* Section blocks */
    .report-section {
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      margin-bottom: 12pt !important;
      box-shadow: none !important;
    }
    .report-section h3 {
      font-size: 11pt !important;
      font-weight: 700 !important;
      color: #000 !important;
      border: none !important;
      border-bottom: 1pt solid #000 !important;
      padding: 0 0 3pt 0 !important;
      margin-bottom: 6pt !important;
      background: transparent !important;
    }
    .content {
      font-size: 10.5pt !important;
      line-height: 1.8 !important;
      color: #000 !important;
      background: transparent !important;
    }
    /* Hide web footer */
    .footer { display: none !important; }
  `;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function HwpDocumentPreview({
  htmlContent,
  data,
  title = 'HWP 미리보기',
  className = '',
  onClose,
}: Props) {
  const [font, setFont]       = useState<FontType>('gothic');
  const [zoom, setZoom]       = useState<ZoomLevel>(100);
  const [activeTab, setActiveTab] = useState(0);
  const [iframeH, setIframeH] = useState(A4_H);

  const fontFamily = FONTS[font];

  // Build iframe srcdoc whenever htmlContent or font changes
  const iframeSrcdoc = useMemo(() => {
    if (!htmlContent) return '';
    const parser = new DOMParser();
    const parsed = parser.parseFromString(htmlContent, 'text/html');
    const body   = parsed.body.innerHTML;
    return `<!DOCTYPE html><html lang="ko"><head>
      <meta charset="UTF-8">
      <style>${buildHwpCss(fontFamily)}</style>
    </head><body>${body}</body></html>`;
  }, [htmlContent, fontFamily]);

  const handlePrint = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    const printCss = buildHwpCss(fontFamily)
      .replace(/padding:.*?;/, '') // body padding handled by @page margin
      + '\n@page { size: A4; margin: 30mm 25mm 25mm 30mm; }';
    let body = '';
    if (htmlContent) {
      const parser = new DOMParser();
      body = parser.parseFromString(htmlContent, 'text/html').body.innerHTML;
    }
    w.document.write(`<!DOCTYPE html><html lang="ko"><head>
      <meta charset="UTF-8"><title>${title}</title>
      <style>${printCss}</style>
    </head><body>${body}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  }, [htmlContent, fontFamily, title]);

  const scale = zoom / 100;
  const tabs  = data?.tabs;

  return (
    <div
      className={`flex flex-col rounded-xl overflow-hidden ${className}`}
      style={{ border: '1.5px solid #1A4496', boxShadow: '0 4px 20px rgba(26,68,150,0.16)' }}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#1A4496 0%,#2558C0 100%)', color: '#fff' }}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-[15px] w-[15px] opacity-75" />
          <span className="text-[12.5px] font-bold tracking-tight">{title}</span>
          <span className="text-[9px] opacity-40 ml-0.5 font-mono">A4</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Font toggle */}
          <div
            className="flex items-center gap-px p-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            {(['gothic', 'myeongjo', 'humanmyeongjo'] as FontType[]).map(f => (
              <button
                key={f}
                onClick={() => setFont(f)}
                className="px-2.5 py-[5px] rounded text-[11px] font-semibold transition-all"
                style={{
                  fontFamily: FONTS[f],
                  background: font === f ? '#fff' : 'transparent',
                  color: font === f ? '#1A4496' : 'rgba(255,255,255,0.8)',
                }}
              >
                {FONT_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Zoom */}
          <div
            className="flex items-center gap-px p-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            {([75, 100, 125] as ZoomLevel[]).map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className="px-2 py-[5px] rounded text-[10.5px] font-mono transition-all"
                style={{
                  background: zoom === z ? '#fff' : 'transparent',
                  color: zoom === z ? '#1A4496' : 'rgba(255,255,255,0.72)',
                }}
              >
                {z}%
              </button>
            ))}
          </div>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11.5px] font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
          >
            <Printer className="h-3.5 w-3.5" />
            인쇄
          </button>

          {onClose && (
            <button onClick={onClose} className="p-1 opacity-70 hover:opacity-100 transition-opacity">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Tab nav (structured data only) ──────────────────────────── */}
      {tabs && tabs.length > 1 && (
        <div
          className="flex items-center gap-1 px-3 py-2 overflow-x-auto flex-shrink-0"
          style={{ background: '#2050A8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
        >
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className="px-3 py-1.5 rounded text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background: activeTab === i ? '#fff' : 'rgba(255,255,255,0.14)',
                color: activeTab === i ? '#1A4496' : 'rgba(255,255,255,0.88)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── A4 Viewer ────────────────────────────────────────────────── */}
      <div
        className="overflow-auto flex-1"
        style={{ background: '#C0C0C0', padding: '28px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            // Reserve vertical space so gray area doesn't collapse when zoomed out
            minHeight: Math.max(A4_H * scale, 400),
          }}
        >
          <div
            style={{
              width: A4_W,
              flexShrink: 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              // Negative margin compensates for scale-down whitespace
              marginBottom: (scale - 1) * iframeH,
            }}
          >
            {htmlContent ? (
              /* HTML string → isolated iframe */
              <iframe
                srcDoc={iframeSrcdoc}
                style={{
                  width: A4_W,
                  height: iframeH,
                  border: 'none',
                  display: 'block',
                  background: '#fff',
                  boxShadow: '0 6px 32px rgba(0,0,0,0.32)',
                }}
                title="HWP 미리보기"
                onLoad={e => {
                  const h = e.currentTarget.contentDocument?.documentElement.scrollHeight;
                  if (h && h > 0) setIframeH(Math.max(h, A4_H));
                }}
              />
            ) : data ? (
              /* Structured data → React HWP components */
              <div
                style={{
                  width: A4_W,
                  minHeight: A4_H,
                  background: '#fff',
                  boxShadow: '0 6px 32px rgba(0,0,0,0.32)',
                  padding: `${PAD.top}px ${PAD.right}px ${PAD.bottom}px ${PAD.left}px`,
                  fontFamily,
                  fontSize: '10.5pt',
                  lineHeight: 1.8,
                  color: '#000',
                  position: 'relative',
                }}
              >
                <StructuredDocBody data={data} activeTab={activeTab} fontFamily={fontFamily} />
                <div style={{
                  position: 'absolute', bottom: 28, left: 0, right: 0,
                  textAlign: 'center', fontSize: '9pt', color: '#777',
                }}>
                  — 1 —
                </div>
              </div>
            ) : (
              <div style={{
                width: A4_W, height: A4_H, background: '#fff',
                boxShadow: '0 6px 32px rgba(0,0,0,0.32)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#aaa', fontSize: '14px',
              }}>
                미리볼 내용이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Structured Document Body ───────────────────────────────────────────────

function StructuredDocBody({
  data, activeTab, fontFamily,
}: {
  data: HwpDocumentData;
  activeTab: number;
  fontFamily: string;
}) {
  const tabData  = data.tabs?.[activeTab];
  const meta     = tabData?.meta;
  const sections = tabData?.sections ?? data.sections ?? [];

  return (
    <div>
      {/* Document header */}
      <div style={{
        textAlign: 'center',
        borderBottom: '2pt solid #000',
        paddingBottom: '10pt',
        marginBottom: '18pt',
      }}>
        {data.organization && (
          <p style={{ fontSize: '9pt', color: '#555', marginBottom: '4pt' }}>{data.organization}</p>
        )}
        <h1 style={{ fontSize: '18pt', fontWeight: 700, lineHeight: 1.4, fontFamily }}>
          {data.title}
        </h1>
        {data.subtitle && (
          <p style={{ fontSize: '11pt', color: '#333', marginTop: '5pt' }}>{data.subtitle}</p>
        )}
        {data.date && (
          <p style={{ fontSize: '9pt', color: '#555', marginTop: '8pt', textAlign: 'right' }}>{data.date}</p>
        )}
      </div>

      {/* Meta table */}
      {meta && meta.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14pt' }}>
          <tbody>
            {meta.map((m, i) => (
              <tr key={i}>
                <td style={{
                  border: '0.5pt solid #888', padding: '5pt 8pt',
                  background: '#F0F0F0', fontWeight: 700, width: '80pt',
                  fontSize: '9.5pt', fontFamily, verticalAlign: 'top',
                }}>
                  {m.label}
                </td>
                <td style={{ border: '0.5pt solid #888', padding: '5pt 8pt', fontSize: '9.5pt', fontFamily }}>
                  {Array.isArray(m.value)
                    ? m.value.map((v, vi) => (
                        <span key={vi} style={{
                          display: 'inline-block',
                          border: '0.5pt solid #aaa',
                          padding: '1pt 5pt',
                          margin: '1pt 2pt 1pt 0',
                          borderRadius: '2pt',
                          fontSize: '8.5pt',
                        }}>{v}</span>
                      ))
                    : m.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Content sections */}
      {sections.map((s, i) => (
        <div key={i} style={{ marginBottom: '14pt' }}>
          <h2 style={{
            fontSize: '11.5pt', fontWeight: 700, fontFamily,
            borderBottom: '1pt solid #000', paddingBottom: '3pt', marginBottom: '7pt',
          }}>
            {s.heading}
          </h2>
          {s.content && (
            <p style={{
              fontSize: '10.5pt', lineHeight: 1.8, fontFamily,
              whiteSpace: 'pre-line', color: '#111',
              marginBottom: s.table ? '6pt' : 0,
            }}>
              {s.content}
            </p>
          )}
          {s.table && <HwpTableRender table={s.table} fontFamily={fontFamily} />}
        </div>
      ))}
    </div>
  );
}

// ── HWP-style table renderer ───────────────────────────────────────────────

function HwpTableRender({
  table, fontFamily,
}: {
  table: HwpTable;
  fontFamily: string;
}) {
  const normCell = (c: string | HwpTableCell): HwpTableCell =>
    typeof c === "string" ? { value: c } : c;

  const cellStyle = (c: HwpTableCell, isHeader: boolean) => ({
    border: '0.5pt solid #888',
    padding: '4pt 6pt',
    fontSize: '9.5pt',
    fontFamily,
    verticalAlign: 'top' as const,
    textAlign: c.align ?? (isHeader ? 'center' : 'left') as 'left' | 'center' | 'right',
    fontWeight: c.bold ?? isHeader ? 700 : 400,
    background: c.bg ?? (isHeader ? '#F0F0F0' : 'transparent'),
    whiteSpace: 'pre-line' as const,
    wordBreak: 'break-word' as const,
  });

  return (
    <div>
      {table.caption && (
        <p style={{
          fontSize: '9.5pt', fontFamily, color: '#444',
          marginBottom: '4pt', fontStyle: 'italic',
        }}>
          {table.caption}
        </p>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8pt' }}>
        {table.columnWidths && (
          <colgroup>
            {table.columnWidths.map((w, i) => (
              <col key={i} style={{ width: typeof w === 'number' ? `${w}%` : w }} />
            ))}
          </colgroup>
        )}
        {table.headers && table.headers.length > 0 && (
          <thead>
            <tr>
              {table.headers.map((h, i) => {
                const c = normCell(h);
                return (
                  <th
                    key={i}
                    rowSpan={c.rowspan}
                    colSpan={c.colspan}
                    style={cellStyle(c, true)}
                  >
                    {c.value}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const c = normCell(cell);
                return (
                  <td
                    key={ci}
                    rowSpan={c.rowspan}
                    colSpan={c.colspan}
                    style={cellStyle(c, false)}
                  >
                    {c.value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Utility: convert arbitrary result JSON to HwpDocumentData ─────────────

const SKIP_KEYS = new Set(['html_content', 'download_url', 'file_path', 'run_id', 'status', 'error']);

export function buildHwpDataFromResult(
  result: Record<string, unknown>,
  title: string,
  subtitle?: string,
): HwpDocumentData {
  // Pattern: result has a 'results' array of report items (one per tab)
  if (Array.isArray(result.results)) {
    const tabs: HwpTabData[] = (result.results as Record<string, unknown>[]).map((item, i) => {
      const meta: HwpTabData['meta'] = [];
      const sections: HwpSection[] = [];
      for (const [key, val] of Object.entries(item)) {
        if (SKIP_KEYS.has(key)) continue;
        if (key.includes('번호') || key.includes('파일') || key.includes('증빙')) {
          meta.push({
            label: key,
            value: Array.isArray(val) ? val.map(String) : String(val ?? ''),
          });
        } else if (typeof val === 'string' && val.trim()) {
          sections.push({ heading: key, content: val });
        }
      }
      return { label: `실적 ${i + 1}`, meta, sections };
    });
    return { title, subtitle, tabs };
  }

  // Fallback: flat key-value sections
  const sections: HwpSection[] = [];
  for (const [key, val] of Object.entries(result)) {
    if (SKIP_KEYS.has(key)) continue;
    if (typeof val === 'string' && val.trim()) {
      sections.push({ heading: key, content: val });
    }
  }
  return { title, subtitle, sections };
}
