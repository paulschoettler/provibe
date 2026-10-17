"use client";

import { useEffect, useRef, useState } from "react";
import { parseEuroToCents } from "@/lib/admin/discounts/rules";
import { calculateBasePrice, formatBasePrice, type UnitMeasure } from "@/lib/pricing";

/**
 * Grundpreis automatisch berechnet (Figma Karte Pfand und Grundpreis): rechnet beim Tippen
 * mit src/lib/pricing (calculateBasePrice), Pfand ist nicht eingerechnet (§ 7 PAngV). Im
 * Server-HTML stehen die gespeicherten Werte, mit JavaScript folgen sie dem Formular.
 */
export interface BasePriceRow {
  index: number;
  title: string;
  priceCents: number;
  unitCount: number;
  isActive: boolean;
}

interface Inputs {
  deposit: number;
  netContent: number | null;
  measure: UnitMeasure;
  rows: BasePriceRow[];
}

function compute(i: Inputs) {
  return i.rows
    .filter((r) => r.isActive && r.priceCents > 0)
    .map((r) => {
      try {
        const bp = calculateBasePrice({
          priceCents: r.priceCents,
          depositCentsPerUnit: i.deposit,
          unitCount: r.unitCount,
          netContentPerUnit: i.netContent,
          measure: i.measure,
        });
        return {
          ...r,
          label: formatBasePrice(bp),
          without: bp.priceWithoutDepositCents,
          deposit: bp.depositCents,
          error: null,
        };
      } catch {
        return { ...r, label: "", without: 0, deposit: 0, error: "Pfand höher als Preis" };
      }
    });
}

const euro = (c: number) =>
  (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export function BasePriceBox({ initial }: { initial: Inputs }) {
  const [inputs, setInputs] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const val = (n: string) =>
        (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
      const checked = (n: string) =>
        (form.elements.namedItem(n) as HTMLInputElement | null)?.checked ?? false;
      const nc = Number(val("netContentPerUnit").replace(",", "."));
      setInputs({
        deposit: parseEuroToCents(val("depositCentsPerUnit") || "0") ?? initial.deposit,
        netContent: Number.isFinite(nc) && nc > 0 ? nc : null,
        measure: (val("basePriceMeasure") || initial.measure) as UnitMeasure,
        rows: initial.rows.map((r) => ({
          ...r,
          title: val(`variants.${r.index}.title`) || r.title,
          priceCents: parseEuroToCents(val(`variants.${r.index}.priceCents`)) ?? r.priceCents,
          unitCount: Number(val(`variants.${r.index}.unitCount`)) || r.unitCount,
          isActive: form.elements.namedItem(`variants.${r.index}.isActive`)
            ? checked(`variants.${r.index}.isActive`)
            : r.isActive,
        })),
      });
    };
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [initial]);

  const rows = compute(inputs);
  const [first, ...rest] = rows;
  return (
    <div ref={ref} className="rounded-admin-feld bg-admin-akzent-hell p-4" aria-live="polite">
      <p className="text-admin-text-2 text-[12px]">Grundpreis automatisch berechnet</p>
      {first ? (
        <>
          <p className="mt-1 text-[26px] leading-tight font-bold">
            {first.error ?? first.label}
            <span className="text-admin-text-2 ml-2 text-[13px] font-normal">
              bei {first.title}
            </span>
          </p>
          {!first.error ? (
            <p className="text-admin-text-2 mt-1 text-[12px]">
              {euro(first.priceCents)} abzüglich {euro(first.deposit)} Pfand = {euro(first.without)}
              {inputs.netContent && inputs.measure !== "piece"
                ? ` / ${(first.unitCount * inputs.netContent).toLocaleString("de-DE", { maximumFractionDigits: 3 })} ${inputs.measure}`
                : ""}
            </p>
          ) : null}
          {rest.length ? (
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
              {rest.map((r) => (
                <div key={r.index} className="contents">
                  <dt className="text-admin-text-2">{r.title}</dt>
                  <dd className="text-right font-bold">{r.error ?? r.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-[14px]">Noch keine aktive Variante mit Preis.</p>
      )}
    </div>
  );
}
