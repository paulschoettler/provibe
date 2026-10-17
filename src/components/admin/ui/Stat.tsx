import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/**
 * Kennzahlkachel nach Figma (26:3890): Label 13 px, Wert 26 px, Veränderung zum Vorzeitraum
 * mit Trendpfeil. Ob "hoch" gut ist, entscheidet goodWhen (zum Beispiel Retouren: runter ist gut).
 */
export interface StatDelta {
  /** fertig formatiert, zum Beispiel "+12,4 %" oder "−0,3 Pp." */
  text: string;
  direction: "up" | "down" | "flat";
  goodWhen?: "up" | "down";
}

export interface StatProps {
  label: string;
  value: ReactNode;
  delta?: StatDelta | null;
  /** Text hinter der Veränderung, Standard "zum Vorzeitraum" */
  deltaSuffix?: string;
  /** Kleiner Hinweis statt Veränderung (zum Beispiel "Keine Vergleichsdaten") */
  hint?: ReactNode;
  className?: string;
}

export function Stat({
  label,
  value,
  delta,
  deltaSuffix = "zum Vorzeitraum",
  hint,
  className,
}: StatProps) {
  const good = delta ? (delta.goodWhen ?? "up") === delta.direction : false;
  const tone =
    !delta || delta.direction === "flat"
      ? "text-admin-text-2"
      : good
        ? "text-admin-gruen"
        : "text-admin-rot";
  return (
    <div
      className={cx(
        "rounded-admin-karte border-admin-rahmen bg-admin-karte flex min-w-0 flex-col gap-1.5 border p-4",
        className,
      )}
    >
      <p className="text-admin-text-2 text-[13px] font-medium">{label}</p>
      <p className="text-[22px] leading-[1.4] font-semibold tabular-nums md:text-[26px]">{value}</p>
      {delta ? (
        <p className="flex flex-wrap items-center gap-1 text-[13px]">
          {delta.direction !== "flat" ? (
            <span className={tone}>
              <Icon name={delta.direction === "up" ? "trend-hoch" : "trend-runter"} size={16} />
            </span>
          ) : null}
          <span className={cx("font-semibold tabular-nums", tone)}>{delta.text}</span>
          <span className="text-admin-text-2 max-md:hidden">{deltaSuffix}</span>
        </p>
      ) : hint ? (
        <p className="text-admin-text-2 text-[13px]">{hint}</p>
      ) : null}
    </div>
  );
}
