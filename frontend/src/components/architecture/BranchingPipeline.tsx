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

export interface PipelineGraphGroup {
  cells: [number, number][];
  label?: string;
  color?: string;
  mode?: "box" | "individual" | "merge";
}

export interface PipelineGraph {
  rows: (PipelineGraphNode | null)[][];
  edges: PipelineGraphEdge[];
  groups?: PipelineGraphGroup[];
}

export interface PipelineGroupEffect {
  index: number;
  effect: "glow-dim" | "ants";
}

export function BranchingPipeline({
  graph,
  color,
  activeGroups,
}: {
  graph: PipelineGraph;
  color: string;
  activeGroups?: PipelineGroupEffect[];
}) {
  const MIN_W = 90;
  const MAX_W = 120;
  const NODE_H = 58;
  const GAP_X = 44;
  const GAP_Y = 34;
  const PAD = 20;
  const PX_PAD = 20;
  const CELL_H = NODE_H + GAP_Y;

  const maxCols = Math.max(...graph.rows.map((r) => r.length));
  const numRows = graph.rows.length;

  const estimateWidth = (label: string): number => {
    let w = 0;
    for (const ch of label) {
      w += ch.charCodeAt(0) > 127 ? 11 : 7;
    }
    return Math.min(MAX_W, Math.max(MIN_W, w + PX_PAD));
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

  // ── active group state ──────────────────────────────────────────────────
  const activeGroupMap = new Map(
    (activeGroups ?? []).map(({ index, effect }) => [index, effect])
  );
  const hasAnyActive = activeGroupMap.size > 0;
  const hasDimEffect = hasAnyActive;

  const activeCellSet = new Set<string>();
  (graph.groups ?? []).forEach((group, gi) => {
    if (activeGroupMap.has(gi)) {
      group.cells.forEach(([r, c]) => activeCellSet.add(`${r},${c}`));
    }
  });

  // Generate @keyframes for each glow-dim group dynamically
  const glowKeyframes = (activeGroups ?? [])
    .filter(({ effect }) => effect === "glow-dim")
    .map(({ index }) => {
      const g = graph.groups?.[index];
      if (!g) return "";
      const hex = (g.color ?? "#94a3b8").replace("#", "");
      return `@keyframes bpGlow${hex} {
        0%,100% { box-shadow: 0 0 0 2px #${hex}26, 0 0 8px 0 #${hex}26; }
        50%      { box-shadow: 0 0 0 4px #${hex}55, 0 0 22px 6px #${hex}44; }
      }`;
    })
    .join("\n");

  const injectedCss = `
    ${glowKeyframes}
    @keyframes bpMarchAnts { to { stroke-dashoffset: -24; } }
  `;

  // ── port / edge helpers (unchanged) ────────────────────────────────────
  type Port = "left" | "right" | "top" | "bottom";

  const cx = (c: number) => colLeft[c] + colWidths[c] / 2;
  const cy = (r: number) => PAD + r * CELL_H + NODE_H / 2;
  const nw = (c: number) => colWidths[c];

  const getEdgePorts = (edge: PipelineGraphEdge) => {
    if (edge.srcPort && edge.tgtPort)
      return { src: edge.srcPort as Port, tgt: edge.tgtPort as Port };
    const [fr, fc] = edge.from;
    const [tr, tc] = edge.to;
    if (fr === tr)
      return tc > fc
        ? { src: "right" as Port, tgt: "left" as Port }
        : { src: "bottom" as Port, tgt: "bottom" as Port };
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
    const maxDim =
      side === "top" || side === "bottom" ? nw(c) : NODE_H;
    const spread = Math.min(maxDim * 0.4, edges.length * 14);
    return -spread / 2 + (pos / (edges.length - 1)) * spread;
  };

  const edgeEndpoint = (rc: [number, number], side: Port, off: number) => {
    const [r, c] = rc;
    const x =
      side === "right"
        ? cx(c) + nw(c) / 2
        : side === "left"
        ? cx(c) - nw(c) / 2
        : cx(c) + off;
    const y =
      side === "bottom"
        ? cy(r) + NODE_H / 2
        : side === "top"
        ? cy(r) - NODE_H / 2
        : cy(r) + off;
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
        s: {
          x: sx0 - R + R * Math.cos(angle),
          y: sy0 - R + R * Math.sin(angle),
        },
        t: {
          x: ex0 + R - R * Math.cos(angle),
          y: ey0 + R - R * Math.sin(angle),
        },
        src,
        tgt,
      };
    }

    if (
      !edge.srcPort &&
      !edge.tgtPort &&
      ((fr === tr && src === "right" && tgt === "left") || fc === tc)
    ) {
      return {
        s: edgeEndpoint(edge.from, src, 0),
        t: edgeEndpoint(edge.to, tgt, 0),
        src,
        tgt,
      };
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
      if (src === "right" && tgt === "top") return `M${s.x},${s.y} L${t.x},${t.y}`;
      const srcH = src === "right" || src === "left";
      const tgtH = tgt === "right" || tgt === "left";
      const srcV = src === "top" || src === "bottom";
      const tgtV = tgt === "top" || tgt === "bottom";
      if (srcH && tgtH) {
        const mx = (s.x + t.x) / 2;
        return `M${s.x},${s.y} L${mx},${s.y} L${mx},${t.y} L${t.x},${t.y}`;
      }
      if (srcV && tgtV) {
        const my = (s.y + t.y) / 2;
        return `M${s.x},${s.y} L${s.x},${my} L${t.x},${my} L${t.x},${t.y}`;
      }
      if (srcH) return `M${s.x},${s.y} L${t.x},${s.y} L${t.x},${t.y}`;
      return `M${s.x},${s.y} L${s.x},${t.y} L${t.x},${t.y}`;
    }

    if (fr === tr && tc > fc) return `M${s.x},${s.y} L${t.x},${t.y}`;
    if (fr === tr && tc < fc) {
      const bottomY = cy(fr) + NODE_H / 2 + GAP_Y / 2;
      return `M${s.x},${s.y} L${s.x},${bottomY} L${t.x},${bottomY} L${t.x},${t.y}`;
    }
    if (fc === tc) return `M${s.x},${s.y} L${t.x},${t.y}`;
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

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div
      className="overflow-x-auto rounded-2xl p-6 scrollbar-hide"
      style={{ backgroundColor: "#f9fafb", border: `1px solid ${color}25` }}
    >
      {hasAnyActive && <style>{injectedCss}</style>}

      <div className="relative" style={{ width: totalW, height: totalH }}>
        {/* 그룹 배경 박스 */}
        {(graph.groups ?? []).flatMap((group, gi) => {
          if (group.cells.length === 0) return [];
          const gColor = group.color ?? "#94a3b8";
          const effect = activeGroupMap.get(gi);
          const isActive = effect !== undefined;
          const isDimmed = hasDimEffect && !isActive;

          const dimStyle: React.CSSProperties = isDimmed
            ? { opacity: 0.6, transition: "opacity 0.3s ease" }
            : {};

          // individual 모드
          if (group.mode === "individual") {
            const pad = 6;
            return group.cells.map(([r, c], ci) => (
              <div
                key={`group-${gi}-${ci}`}
                className="absolute pointer-events-none"
                style={{
                  left: colLeft[c] - pad,
                  top: PAD + r * CELL_H - pad,
                  width: colWidths[c] + pad * 2,
                  height: NODE_H + pad * 2,
                  borderRadius: 12,
                  border: `1.5px dashed ${gColor}33`,
                  backgroundColor: `${gColor}0d`,
                  ...dimStyle,
                }}
              />
            ));
          }

          // merge 모드
          if (group.mode === "merge") {
            const cellSet = new Set(group.cells.map(([r, c]) => `${r},${c}`));
            const visited = new Set<string>();
            const components: Array<[number, number][]> = [];
            for (const cell of group.cells) {
              const k0 = `${cell[0]},${cell[1]}`;
              if (visited.has(k0)) continue;
              const comp: [number, number][] = [];
              const queue: [number, number][] = [cell];
              while (queue.length) {
                const [r, c] = queue.shift()!;
                const k = `${r},${c}`;
                if (visited.has(k)) continue;
                visited.add(k);
                comp.push([r, c]);
                for (const [dr, dc] of [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                ]) {
                  const nk = `${r + dr},${c + dc}`;
                  if (cellSet.has(nk) && !visited.has(nk))
                    queue.push([r + dr, c + dc]);
                }
              }
              components.push(comp);
            }
            const pad = 16;
            return components.map((comp, compIdx) => {
              const rects = comp.map(([r, c]) => ({
                x: colLeft[c],
                y: PAD + r * CELL_H,
                w: colWidths[c],
                h: NODE_H,
              }));
              const minX = Math.min(...rects.map((r) => r.x));
              const minY = Math.min(...rects.map((r) => r.y));
              const maxX = Math.max(...rects.map((r) => r.x + r.w));
              const maxY = Math.max(...rects.map((r) => r.y + r.h));
              const showLabel = Boolean(group.label) && compIdx === 0;

              const hexKey = gColor.replace("#", "");

              const glowStyle: React.CSSProperties =
                effect === "glow-dim"
                  ? {
                      border: `1.5px solid ${gColor}99`,
                      backgroundColor: `${gColor}1c`,
                      animation: `bpGlow${hexKey} 2s ease-in-out infinite`,
                      zIndex: 1,
                    }
                  : {
                      border: `1.5px dashed ${gColor}33`,
                      backgroundColor: `${gColor}0d`,
                    };

              return (
                <div
                  key={`group-${gi}-comp-${compIdx}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: minX - pad,
                    top: minY - pad,
                    width: maxX - minX + pad * 2,
                    height: maxY - minY + pad * 2,
                    borderRadius: 12,
                    ...glowStyle,
                    ...dimStyle,
                  }}
                >
                  {/* Marching ants overlay */}
                  {effect === "ants" && (
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                        pointerEvents: "none",
                      }}
                    >
                      <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        rx="12"
                        ry="12"
                        fill="none"
                        stroke={`${gColor}88`}
                        strokeWidth="1.5"
                        strokeDasharray="3 6"
                        style={{ animation: "bpMarchAnts 1.2s linear infinite" }}
                      />
                    </svg>
                  )}

                  {showLabel && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 rounded px-3 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap"
                      style={{ color: gColor, backgroundColor: "#ffffff", border: `1px solid ${gColor}66` }}
                    >
                      {group.label}
                    </span>
                  )}
                </div>
              );
            });
          }

          // bounding box 모드 (기본)
          const cellRects = group.cells.map(([r, c]) => ({
            x: colLeft[c],
            y: PAD + r * CELL_H,
            w: colWidths[c],
            h: NODE_H,
          }));
          const minX = Math.min(...cellRects.map((r) => r.x));
          const minY = Math.min(...cellRects.map((r) => r.y));
          const maxX = Math.max(...cellRects.map((r) => r.x + r.w));
          const maxY = Math.max(...cellRects.map((r) => r.y + r.h));
          const innerPad = 12;
          return [
            <div
              key={`group-${gi}`}
              className="absolute pointer-events-none"
              style={{
                left: minX - innerPad,
                top: minY - innerPad,
                width: maxX - minX + innerPad * 2,
                height: maxY - minY + innerPad * 2,
                borderRadius: 12,
                border: `1.5px dashed ${gColor}33`,
                backgroundColor: `${gColor}0d`,
                ...dimStyle,
              }}
            >
              {group.label && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 -bottom-2.5 rounded px-3 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap"
                  style={{ color: gColor, backgroundColor: "#ffffff", border: `1px solid ${gColor}66` }}
                >
                  {group.label}
                </span>
              )}
            </div>,
          ];
        })}

        {/* 엣지 (하단 레이어) */}
        <svg className="absolute inset-0 pointer-events-none" width={totalW} height={totalH}>
          <defs>
            <marker
              id="bp-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#9ca3af" />
            </marker>
          </defs>
          {graph.edges.map((edge, i) => {
            const { s, t, src, tgt } = computeEdge(edge, i);
            const srcH = src === "right" || src === "left";
            const tgtH = tgt === "right" || tgt === "left";
            const [fr, fc] = edge.from;
            const [tr, tc] = edge.to;
            let lx = 0,
              ly = 0;
            if (edge.label) {
              if (fc === tc) {
                lx = s.x;
                ly = (s.y + t.y) / 2;
              } else if (fr === tr) {
                lx = (s.x + t.x) / 2;
                ly = s.y;
              } else if (srcH && !tgtH) {
                lx = (s.x + t.x) / 2;
                ly = s.y;
              } else if (!srcH && tgtH) {
                lx = s.x;
                ly = (s.y + t.y) / 2;
              } else {
                lx = (s.x + t.x) / 2;
                ly = (s.y + t.y) / 2;
              }
            }
            const edgeActive =
              !hasDimEffect ||
              (activeCellSet.has(`${fr},${fc}`) && activeCellSet.has(`${tr},${tc}`));
            return (
              <g key={i} opacity={edgeActive ? 1 : 0.6} style={{ transition: "opacity 0.3s ease" }}>
                <path
                  d={buildPath(edge, i)}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth={1}
                  strokeDasharray="5 3"
                  markerEnd="url(#bp-arrow)"
                />
                {edge.label && (
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#6b7280"
                    fontSize={10}
                    fontWeight={600}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* 노드 */}
        {graph.rows.map((row, ri) =>
          row.map((node, ci) => {
            if (!node) return null;
            const nodeActive =
              !hasAnyActive || activeCellSet.has(`${ri},${ci}`);
            return (
              <div
                key={`${ri}-${ci}`}
                className="absolute"
                style={{
                  left: colLeft[ci],
                  top: PAD + ri * CELL_H,
                  width: colWidths[ci],
                  height: NODE_H,
                  opacity: nodeActive ? 1 : 0.6,
                  transition: "opacity 0.3s ease",
                }}
              >
                <div
                  className="relative flex flex-col items-center justify-center rounded-xl bg-white shadow-md px-3"
                  style={{
                    width: colWidths[ci],
                    height: NODE_H,
                    border: node.conditional
                      ? `2px dashed ${color}80`
                      : "1px solid #e5e7eb",
                  }}
                >
                  <span className="text-center text-[10px] font-medium leading-tight text-gray-700">
                    {node.label}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* 엣지 시작점 원 (상단 레이어) */}
        <svg className="absolute inset-0 pointer-events-none" width={totalW} height={totalH}>
          {graph.edges.map((edge, i) => {
            const { s } = computeEdge(edge, i);
            return (
              <g key={i}>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={4}
                  fill="white"
                  stroke="#d1d5db"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
