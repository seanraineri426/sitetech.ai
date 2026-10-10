// Topographic site overview: contours traced from a Gaussian elevation field
// via marching squares, the same technique used by real topo-map generators.

const SIZE = 360;
const RES = 64;

type Peak = { x: number; y: number; a: number; s: number };

const peaks: Peak[] = [
  { x: 120, y: 132, a: 1.0, s: 70 },
  { x: 250, y: 205, a: 0.85, s: 62 },
  { x: 188, y: 300, a: 0.55, s: 52 },
  { x: 304, y: 78, a: -0.4, s: 56 },
];

function elevation(x: number, y: number) {
  let e = 0;
  for (const p of peaks) {
    const dx = x - p.x;
    const dy = y - p.y;
    e += p.a * Math.exp(-(dx * dx + dy * dy) / (2 * p.s * p.s));
  }
  return e;
}

function buildContours() {
  const g: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j <= RES; j++) {
    g[j] = [];
    for (let i = 0; i <= RES; i++) {
      const v = elevation((i / RES) * SIZE, (j / RES) * SIZE);
      g[j][i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  for (let j = 0; j <= RES; j++)
    for (let i = 0; i <= RES; i++) g[j][i] = (g[j][i] - min) / (max - min);

  const levels = Array.from({ length: 11 }, (_, k) => 0.08 + (k / 10) * 0.85);

  return levels.map((t, k) => {
    let d = "";
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const x0 = (i / RES) * SIZE;
        const x1 = ((i + 1) / RES) * SIZE;
        const y0 = (j / RES) * SIZE;
        const y1 = ((j + 1) / RES) * SIZE;
        const tl = g[j][i];
        const tr = g[j][i + 1];
        const br = g[j + 1][i + 1];
        const bl = g[j + 1][i];

        const T = (): [number, number] => [x0 + ((t - tl) / (tr - tl)) * (x1 - x0), y0];
        const R = (): [number, number] => [x1, y0 + ((t - tr) / (br - tr)) * (y1 - y0)];
        const B = (): [number, number] => [x1 + ((t - br) / (bl - br)) * (x0 - x1), y1];
        const L = (): [number, number] => [x0, y1 + ((t - bl) / (tl - bl)) * (y0 - y1)];

        const idx =
          (tl > t ? 8 : 0) | (tr > t ? 4 : 0) | (br > t ? 2 : 0) | (bl > t ? 1 : 0);

        const seg = (p: [number, number], q: [number, number]) => {
          d += `M ${p[0].toFixed(1)} ${p[1].toFixed(1)} L ${q[0].toFixed(1)} ${q[1].toFixed(1)} `;
        };

        switch (idx) {
          case 1: seg(L(), B()); break;
          case 2: seg(B(), R()); break;
          case 3: seg(L(), R()); break;
          case 4: seg(T(), R()); break;
          case 5: seg(T(), L()); seg(B(), R()); break;
          case 6: seg(T(), B()); break;
          case 7: seg(T(), L()); break;
          case 8: seg(T(), L()); break;
          case 9: seg(T(), B()); break;
          case 10: seg(T(), R()); seg(B(), L()); break;
          case 11: seg(T(), R()); break;
          case 12: seg(L(), R()); break;
          case 13: seg(R(), B()); break;
          case 14: seg(B(), L()); break;
        }
      }
    }
    return { d, alpha: 0.1 + k * 0.02 };
  });
}

const contours = buildContours();

const spots = [
  { x: 120, y: 132, label: "142" },
  { x: 250, y: 205, label: "118" },
  { x: 188, y: 300, label: "96" },
];

const bm = { x: 150, y: 168, w: 34, h: 24 };

const ledger = [
  { id: "OAC-12", action: "actions extracted", result: "9 assigned" },
  { id: "RFI-118", action: "aging 6 days", result: "escalated" },
  { id: "RECERT", action: "17 due", result: "60 days" },
];

export function HeroSchematic() {
  return (
    <div className="relative w-full animate-fade-up">
      <div
        className="pointer-events-none absolute left-1/2 top-[40%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)",
        }}
      />

      <svg viewBox="0 0 360 360" className="relative w-full" fill="none" aria-hidden>
        {/* contour lines */}
        <g className="animate-topo-breathe">
          {contours.map((c, k) => (
            <path
              key={k}
              d={c.d}
              stroke={`rgba(255,255,255,${c.alpha})`}
              strokeWidth={1}
              pathLength={1}
              style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="1"
                to="0"
                dur="1.6s"
                begin={`${0.3 + k * 0.12}s`}
                fill="freeze"
              />
            </path>
          ))}
        </g>

        {/* property boundary */}
        <rect
          x={16}
          y={16}
          width={328}
          height={328}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1}
          strokeDasharray="2 5"
          rx={1}
        />

        {/* spot heights */}
        {spots.map((s, i) => (
          <g key={i}>
            <line x1={s.x - 3.5} y1={s.y} x2={s.x + 3.5} y2={s.y} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
            <line x1={s.x} y1={s.y - 3.5} x2={s.x} y2={s.y + 3.5} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
            <text
              x={s.x + 6}
              y={s.y + 3}
              fill="rgba(255,255,255,0.5)"
              fontSize={7.5}
              fontFamily="var(--font-mono), monospace"
              letterSpacing="0.5"
            >
              {s.label}
            </text>
          </g>
        ))}

        {/* benchmark / buildable pad */}
        <g>
          <rect
            x={bm.x}
            y={bm.y}
            width={bm.w}
            height={bm.h}
            fill="rgba(255,255,255,0.05)"
            stroke="#ffffff"
            strokeWidth={1.2}
          />
          <circle cx={bm.x + bm.w / 2} cy={bm.y + bm.h / 2} r={2.2} fill="#ffffff" />
          <circle
            cx={bm.x + bm.w / 2}
            cy={bm.y + bm.h / 2}
            r={5}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1}
          >
            <animate attributeName="r" values="5;26" dur="5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0" dur="5s" repeatCount="indefinite" />
          </circle>
          <text
            x={bm.x}
            y={bm.y - 6}
            fill="rgba(255,255,255,0.75)"
            fontSize={8}
            fontFamily="var(--font-mono), monospace"
            letterSpacing="1.5"
          >
            BM 04
          </text>
        </g>
      </svg>

      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-node" />
          Operating layer
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">
          live
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {ledger.map((row, i) => (
          <div
            key={row.id}
            className="flex items-center gap-3 font-mono text-[10px] tracking-wide text-gray-500 animate-fade-up"
            style={{ animationDelay: `${0.8 + i * 0.25}s` }}
          >
            <span className="h-1 w-1 shrink-0 rounded-full bg-white/50" />
            <span className="w-[68px] shrink-0 text-gray-300">{row.id}</span>
            <span className="flex-1 truncate text-gray-500">{row.action}</span>
            <span className="shrink-0 text-gray-300">{row.result}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 font-mono text-[10px] leading-relaxed tracking-wide text-gray-500">
        Meetings · RFIs · Approvals · Recertifications · Ledger
      </p>
    </div>
  );
}
