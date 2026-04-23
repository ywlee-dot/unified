"use client";

export interface PipelineGraphNode {
  label: string;
  conditional?: boolean;
  step?: number;
}

export interface PipelineGraphEdge {
  from: [number, number];
  to: [number, number];
  label?: string;
  srcPort?: "left" | "right" | "top" | "bottom";
  tgtPort?: "left" | "right" | "top" | "bottom";
}

export interface PipelineGraph {
  rows: (PipelineGraphNode | null)[][];
  edges: PipelineGraphEdge[];
}

export function BranchingPipeline({ graph, color }: { graph: PipelineGraph; color: string }) {
  const MIN_W = 100;
  const NODE_H = 68;
  const GAP_X = 32;
  const GAP_Y = 48;
  const PAD = 24;
  const PX_PAD = 28;
  const CELL_H = NODE_H + GAP_Y;

  const maxCols = Math.max(...graph.rows.map((r) => r.length));
  const numRows = graph.rows.length;

  let count = 0;
  const nodeNums: Record<string, number> = {};
  graph.rows.forEach((row, ri) =>
    row.forEach((node, ci) => {
      if (node) nodeNums[`${ri}-${ci}`] = node.step ?? ++count;
    })
  );

  const estimateWidth = (label: string): number => {
    let w = 0;
    for (const ch of label) {
      w += ch.charCodeAt(0) > 127 ? 11 : 7;
    }
    return Math.max(MIN_W, w + PX_PAD);
  };

  const colWidths: number[] = Array(maxCols).fill(MIN_W);
  graph.rows.forEach((row) => {
    row.forEach((node, ci) => {
      if (node) colWidths[ci] = Math.max(colWidths[ci], estimateWidth(node.label));
    });
  });

  const colLeft: number[] = [PAD];
  for (let i = 1; i < maxCols; i++) {
    colLeft[i] = colLeft[i - 1] + colWidths[i - 1] + GAP_X;
  }

  const totalW = colLeft[maxCols - 1] + colWidths[maxCols - 1] + PAD;
  const totalH = PAD * 2 + numRows * CELL_H - GAP_Y;

  type Port = "left" | "right" | "top" | "bottom";

  const cx = (c: number) => colLeft[c] + colWidths[c] / 2;
  const cy = (r: number) => PAD + r * CELL_H + NODE_H / 2;
  const nw = (c: number) => colWidths[c];

  const getEdgePorts = (edge: PipelineGraphEdge) => {
    if (edge.srcPort && edge.tgtPort) return { src: edge.srcPort as Port, tgt: edge.tgtPort as Port };
    const [fr, fc] = edge.from;
    const [tr, tc] = edge.to;
    if (fr === tr) return tc > fc ? { src: "right" as Port, tgt: "left" as Port } : { src: "bottom" as Port, tgt: "bottom" as Port };
    if (tr > fr) return { src: "bottom" as Port, tgt: "top" as Port };
    if (tc < fc) return { src: "bottom" as Port, tgt: "bottom" as Port };
    return { src: "top" as Port, tgt: "bottom" as Port };
  };

  const portEdgeMap: Record<string, number[]> = {};
  graph.edges.forEach((edge, i) => {
    const { src, tgt } = getEdgePorts(edge);
    (portEdgeMap[`${edge.from[0]}-${edge.from[1]}:${src}`] ??= []).push(i);
    (portEdgeMap[`${edge.to[0]}-${edge.to[1]}:${tgt}`] ??= []).push(i);
  });

  const portOff = (r: number, c: number, side: Port, edgeIdx: number): number => {
    const edges = portEdgeMap[`${r}-${c}:${side}`] || [];
    if (edges.length <= 1) return 0;
    const pos = edges.indexOf(edgeIdx);
    const maxDim = (side === "top" || side === "bottom") ? nw(c) : NODE_H;
    const spread = Math.min(maxDim * 0.4, edges.length * 14);
    return -spread / 2 + (pos / (edges.length - 1)) * spread;
  };

  const edgeEndpoint = (rc: [number, number], side: Port, off: number) => {
    const [r, c] = rc;
    const x = side === "right" ? cx(c) + nw(c) / 2 : side === "left" ? cx(c) - nw(c) / 2 : cx(c) + off;
    const y = side === "bottom" ? cy(r) + NODE_H / 2 : side === "top" ? cy(r) - NODE_H / 2 : cy(r) + off;
    return { x, y };
  };

  const computeEdge = (edge: PipelineGraphEdge, i: number) => {
    const { src, tgt } = getEdgePorts(edge);
    const [fr, fc] = edge.from;
    const [tr, tc] = edge.to;

    if (edge.srcPort === "right" && edge.tgtPort === "top") {
      const R = 12;
      const sx0 = cx(fc) + nw(fc) / 2;
      const sy0 = cy(fr) + NODE_H / 2;
      const ex0 = cx(tc) - nw(tc) / 2;
      const ey0 = cy(tr) - NODE_H / 2;
      const angle = Math.atan2(ey0 - sy0, ex0 - sx0);
      return {
        s: { x: (sx0 - R) + R * Math.cos(angle), y: (sy0 - R) + R * Math.sin(angle) },
        t: { x: (ex0 + R) - R * Math.cos(angle), y: (ey0 + R) - R * Math.sin(angle) },
        src, tgt,
      };
    }

    if (!edge.srcPort && !edge.tgtPort && ((fr === tr && src === "right" && tgt === "left") || fc === tc)) {
      return { s: edgeEndpoint(edge.from, src, 0), t: edgeEndpoint(edge.to, tgt, 0), src, tgt };
    }

    const sOff = portOff(fr, fc, src, i);
    const tOff = portOff(tr, tc, tgt, i);
    const s = edgeEndpoint(edge.from, src, sOff);
    const t = edgeEndpoint(edge.to, tgt, tOff);
    return { s, t, src, tgt };
  };

  const buildPath = (edge: PipelineGraphEdge, edgeIdx: number) => {
    const { s, t, src, tgt } = computeEdge(edge, edgeIdx);
    const [fr, fc] = edge.from;
    const [tr, tc] = edge.to;

    if (edge.srcPort || edge.tgtPort) {
      if (src === "right" && tgt === "top") {
        return `M${s.x},${s.y} L${t.x},${t.y}`;
      }
      if (src === "right" || src === "left") {
        return `M${s.x},${s.y} L${t.x},${s.y} L${t.x},${t.y}`;
      }
      return `M${s.x},${s.y} L${s.x},${t.y} L${t.x},${t.y}`;
    }

    if (fr === tr && tc > fc) {
      return `M${s.x},${s.y} L${t.x},${t.y}`;
    }
    if (fr === tr && tc < fc) {
      const bottomY = cy(fr) + NODE_H / 2 + GAP_Y / 2;
      return `M${s.x},${s.y} L${s.x},${bottomY} L${t.x},${bottomY} L${t.x},${t.y}`;
    }
    if (fc === tc) {
      return `M${s.x},${s.y} L${t.x},${t.y}`;
    }
    if (tr > fr) {
      const midY = cy(fr) + NODE_H / 2 + GAP_Y / 2;
      return `M${s.x},${s.y} L${s.x},${midY} L${t.x},${midY} L${t.x},${t.y}`;
    }
    if (tc < fc) {
      const bottomY = cy(fr) + NODE_H / 2 + 16;
      return `M${s.x},${s.y} L${s.x},${bottomY} L${t.x},${bottomY} L${t.x},${t.y}`;
    }
    const midY = cy(tr) + NODE_H / 2 + GAP_Y / 2;
    return `M${s.x},${s.y} L${s.x},${midY} L${t.x},${midY} L${t.x},${t.y}`;
  };

  return (
    <div
      className="overflow-x-auto rounded-2xl p-6 scrollbar-hide"
      style={{ backgroundColor: "#f9fafb", border: `1px solid ${color}25` }}
    >
      <div className="relative" style={{ width: totalW, height: totalH }}>
        <svg className="absolute inset-0 pointer-events-none" width={totalW} height={totalH}>
          {graph.edges.map((edge, i) => {
            const [fr, fc] = edge.from;
            const [tr, tc] = edge.to;

            let lx = 0, ly = 0, anchor: "start" | "middle" | "end" = "middle";
            if (edge.label) {
              if (fc === tc) {
                lx = cx(fc) + nw(fc) / 2 + 6;
                ly = (cy(fr) + cy(tr)) / 2 + 4;
                anchor = "start";
              } else {
                lx = (cx(fc) + cx(tc)) / 2;
                ly = cy(fr) - NODE_H / 2 - 4;
              }
            }
            return (
              <g key={i}>
                <path d={buildPath(edge, i)} fill="none" stroke="#d1d5db" strokeWidth={1} strokeDasharray="5 3" />
                {edge.label && (
                  <text x={lx} y={ly} textAnchor={anchor} fill="#9ca3af" fontSize={9} fontStyle="italic">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {graph.rows.map((row, ri) =>
          row.map((node, ci) => {
            if (!node) return null;
            return (
              <div
                key={`${ri}-${ci}`}
                className="absolute"
                style={{ left: colLeft[ci], top: PAD + ri * CELL_H, width: colWidths[ci], height: NODE_H }}
              >
                <div
                  className="relative flex flex-col items-start justify-center rounded-xl bg-white shadow-md px-3"
                  style={{
                    width: colWidths[ci],
                    height: NODE_H,
                    border: node.conditional ? `2px dashed ${color}80` : "1px solid #e5e7eb",
                  }}
                >
                  <span className="text-[10px] font-semibold tracking-wide" style={{ color }}>
                    STEP {nodeNums[`${ri}-${ci}`]}.
                  </span>
                  <span className="mt-0.5 text-left text-[12px] font-medium leading-tight text-gray-700">
                    {node.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <svg className="absolute inset-0 pointer-events-none" width={totalW} height={totalH}>
          {graph.edges.map((edge, i) => {
            const { s, t } = computeEdge(edge, i);
            return (
              <g key={i}>
                <circle cx={s.x} cy={s.y} r={4} fill="white" stroke="#d1d5db" strokeWidth={1.5} />
                <circle cx={t.x} cy={t.y} r={4} fill="white" stroke="#d1d5db" strokeWidth={1.5} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
