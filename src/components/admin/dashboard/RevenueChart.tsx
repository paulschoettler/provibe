"use client";

import { useId, useState } from "react";
import { formatEur } from "@/lib/money";

/**
 * Umsatzkurve (Figma 28:5911) als Inline-SVG ohne Chart-Bibliothek. Zeitraum als 2-px-Linie in
 * Magenta mit Fläche und Punkten, Vorzeitraum gestrichelt in Grau (Strichart als zweite Kodierung).
 * Linien und Flächen skalieren mit der Breite (non-scaling-stroke), Punkte, Achsen und Tooltip sind
 * HTML. Fadenkreuz mit Tooltip bei Zeiger und Tastatur (Pfeiltasten), Tabelle für Screenreader.
 */
export interface ChartPoint {
  key: string;
  label: string;
  current: number;
  previous: number;
}

const W = 1000;
const H = 300;
const PREV_COLOR = "#8a8f98";

function niceMax(value: number): number {
  if (value <= 0) return 10000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 2.5, 4, 5, 10]) if (step * exp >= value) return step * exp;
  return 10 * exp;
}

/** Kurzlabel für schmale Achsen: "18." für Tage, "6" für Stunden */
function shortLabel(key: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? `${Number(key.slice(8, 10))}.` : String(Number(key));
}

const axisFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

export function RevenueChart({
  points,
  currentLabel,
  previousLabel,
}: {
  points: ChartPoint[];
  currentLabel: string;
  previousLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const max = niceMax(Math.max(0, ...points.map((p) => Math.max(p.current, p.previous))));
  const n = points.length;
  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const line = (key: "current" | "previous") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`)
      .join(" ");
  const area = `${line("current")} L${x(n - 1)},${H} L${x(0)},${H} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 7);
  const pct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-admin-text-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-admin-akzent h-0.5 w-4 rounded" />
          {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <svg aria-hidden="true" width="16" height="2" className="overflow-visible">
            <line
              x1="0"
              y1="1"
              x2="16"
              y2="1"
              stroke={PREV_COLOR}
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          {previousLabel}
        </span>
      </figcaption>

      <div className="flex gap-2">
        {/* y-Achse */}
        <div
          aria-hidden="true"
          className="text-admin-text-2 relative h-[180px] w-12 shrink-0 text-right text-[11px] md:h-[200px]"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 tabular-nums"
              style={{ top: `${100 - (t / max) * 100}%` }}
            >
              {axisFmt.format(t / 100)} €
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative h-[180px] touch-none outline-none md:h-[200px]"
            role="img"
            aria-label={`Umsatzkurve, Details in der Tabelle`}
            aria-describedby={tableId}
            tabIndex={0}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
              if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
              if (e.key === "Escape") setActive(null);
            }}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
            >
              {ticks.map((t) => (
                <line
                  key={t}
                  x1="0"
                  x2={W}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--admin-farbe-rahmen)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={area} fill="var(--admin-farbe-akzent)" fillOpacity="0.08" />
              <path
                d={line("previous")}
                fill="none"
                stroke={PREV_COLOR}
                strokeWidth="2"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              <path
                d={line("current")}
                fill="none"
                stroke="var(--admin-farbe-akzent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            {n <= 31
              ? points.map((p, i) => (
                  <span
                    key={p.key}
                    aria-hidden="true"
                    className="border-admin-akzent bg-admin-karte absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{ left: `${pct(i)}%`, top: `${(y(p.current) / H) * 100}%` }}
                  />
                ))
              : null}
            {active !== null && points[active] ? (
              <>
                <span
                  aria-hidden="true"
                  className="bg-admin-text-2/40 absolute inset-y-0 w-px"
                  style={{ left: `${pct(active)}%` }}
                />
                <span
                  aria-hidden="true"
                  className="border-admin-karte bg-admin-akzent absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${pct(active)}%`,
                    top: `${(y(points[active].current) / H) * 100}%`,
                  }}
                />
                <div
                  role="status"
                  className="rounded-admin-feld border-admin-rahmen bg-admin-karte shadow-admin-karte pointer-events-none absolute top-0 z-10 min-w-36 border px-3 py-2 text-[12px]"
                  style={
                    pct(active) > 60
                      ? { right: `${100 - pct(active)}%`, marginRight: 8 }
                      : { left: `${pct(active)}%`, marginLeft: 8 }
                  }
                >
                  <p className="text-admin-text-2">{points[active].label}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="bg-admin-akzent h-0.5 w-3 rounded" />
                    <strong className="text-[13px] tabular-nums">
                      {formatEur(points[active].current)}
                    </strong>
                  </p>
                  <p className="text-admin-text-2 flex items-center gap-2">
                    <span className="h-0.5 w-3 rounded" style={{ background: PREV_COLOR }} />
                    <span className="tabular-nums">{formatEur(points[active].previous)}</span>
                    <span>Vorzeitraum</span>
                  </p>
                </div>
              </>
            ) : null}
          </div>
          {/* x-Achse */}
          <div aria-hidden="true" className="text-admin-text-2 relative mt-2 h-4 text-[11px]">
            {points.map((p, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <span
                  key={p.key}
                  className="absolute whitespace-nowrap"
                  style={
                    i === 0
                      ? { left: 0 }
                      : i === n - 1
                        ? { right: 0 }
                        : { left: `${pct(i)}%`, transform: "translateX(-50%)" }
                  }
                >
                  <span className={n > 4 ? "max-md:hidden" : undefined}>{p.label}</span>
                  {n > 4 ? <span className="md:hidden">{shortLabel(p.key)}</span> : null}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>

      <table id={tableId} className="sr-only">
        <caption>Umsatz je Zeitabschnitt</caption>
        <thead>
          <tr>
            <th scope="col">Zeit</th>
            <th scope="col">{currentLabel}</th>
            <th scope="col">Vorzeitraum</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              <td>{formatEur(p.current)}</td>
              <td>{formatEur(p.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
