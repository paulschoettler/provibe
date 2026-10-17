"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import { Field, Select } from "@/components/admin/ui/fields";
import { formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { ruleValueToInput } from "@/lib/admin/collections/form";
import {
  opsForField,
  RULE_FIELDS,
  RULE_OPS,
  type CollectionRule,
  type RuleField,
} from "@/lib/admin/collections/rules";
import { StateCheckbox } from "./StateCheckbox";

/**
 * Bedingungen einer regelbasierten Kollektion (Regel-DSL aus src/lib/admin/collections/rules.ts:
 * Liste aus {field, op, value}, alle müssen zutreffen) mit Live-Vorschau der passenden Produkte.
 * Die Vorschau rechnet der Server (previewRulesAction, gleiche Auswertung wie beim Speichern).
 * Ohne JavaScript: feste Zeilen plus eine leere neue Zeile, Entfernen per Checkbox, Vorschau zeigt
 * den gespeicherten Stand.
 */
export interface PreviewItem {
  id: string;
  handle: string;
  title: string;
  status: "active" | "draft" | "archived";
  priceCents: number | null;
  imageUrl: string | null;
}

type PreviewResult =
  | { ok: true; items: PreviewItem[]; total: number }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

interface Row {
  key: number;
  field: RuleField;
  op: string;
  value: string;
  isNew?: boolean;
}

const ENUM_LABELS: Record<string, string> = {
  active: "Aktiv",
  draft: "Entwurf",
  archived: "Archiviert",
  simple: "Einzelprodukt",
  bundle: "Bundle",
};

function noop() {
  return () => {};
}

export function RulesEditor({
  rules,
  initialPreview,
  preview,
  disabled,
}: {
  rules: CollectionRule[];
  initialPreview: PreviewItem[];
  preview: (rows: Record<string, string>, sortKey: string) => Promise<PreviewResult>;
  disabled?: boolean;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const seq = useRef(rules.length + 1);
  const [rows, setRows] = useState<Row[]>(() => [
    ...rules.map((r, i) => ({
      key: i,
      field: r.field,
      op: r.op,
      value: ruleValueToInput(r.field, r.value),
    })),
  ]);
  const [result, setResult] = useState<PreviewResult>({
    ok: true,
    items: initialPreview,
    total: initialPreview.length,
  });
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Neu aufbauen nach dem Zurücksetzen des Formulars, damit die Felder dem Zustand folgen
  const [version, setVersion] = useState(0);

  const shown: Row[] = hydrated
    ? rows
    : [...rows, { key: -1, field: "tag", op: "eq", value: "", isNew: true }];

  const collect = (list: Row[]) => {
    const out: Record<string, string> = {};
    list.forEach((r, i) => {
      out[`rules.${i}.field`] = r.field;
      out[`rules.${i}.op`] = r.op;
      out[`rules.${i}.value`] = r.value;
      if (r.isNew) out[`rules.${i}.isNew`] = "1";
    });
    return out;
  };

  const sortKeyOf = () => {
    const form = ref.current?.closest("form");
    return (form?.elements.namedItem("sortKey") as HTMLSelectElement | null)?.value ?? "title-asc";
  };

  const refresh = (list: Row[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      start(async () => {
        try {
          setResult(await preview(collect(list), sortKeyOf()));
        } catch {
          setResult({ ok: false, message: "Vorschau gerade nicht möglich.", fieldErrors: {} });
        }
      });
    }, 400);
  };

  const update = (list: Row[]) => {
    setRows(list);
    refresh(list);
    // Formular als geändert melden (Speichern-Leiste), auch beim Entfernen per Button
    ref.current?.dispatchEvent(new Event("input", { bubbles: true }));
  };

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onReset = () => requestAnimationFrame(() => setVersion((n) => n + 1));
    const onSort = (e: Event) => {
      if ((e.target as HTMLElement).getAttribute("name") === "sortKey") refresh(rows);
    };
    form.addEventListener("reset", onReset);
    form.addEventListener("change", onSort);
    return () => {
      form.removeEventListener("reset", onReset);
      form.removeEventListener("change", onSort);
    };
  });

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <p className="text-admin-text-2 text-[13px]">Produkte müssen alle Bedingungen erfüllen.</p>
      {shown.length === 0 ? (
        <p className="text-[14px]">Noch keine Bedingung. Füge mindestens eine hinzu.</p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {shown.map((r, i) => {
          const def = RULE_FIELDS.find((f) => f.value === r.field)!;
          const allowed = opsForField(r.field);
          const p = `rules.${i}`;
          const set = (patch: Partial<Row>) =>
            update(rows.map((x) => (x.key === r.key ? { ...x, ...patch } : x)));
          return (
            <li
              key={`${r.key}-${r.field}-${version}`}
              className="rounded-admin-feld border-admin-rahmen grid gap-2 border p-3 sm:grid-cols-[1fr_1fr_1.3fr_auto] sm:items-start"
            >
              {r.isNew ? <input type="hidden" name={`${p}.isNew`} value="1" /> : null}
              <Select
                name={`${p}.field`}
                label="Feld"
                disabled={disabled}
                defaultValue={r.isNew ? "" : r.field}
                placeholder={r.isNew ? "Neue Bedingung" : undefined}
                onChange={(e) => {
                  const field = e.target.value as RuleField;
                  set({
                    field,
                    op: opsForField(field)[0],
                    value: field === "is_food" ? "true" : "",
                  });
                }}
                options={RULE_FIELDS.map((f) => ({ value: f.value, label: f.label }))}
              />
              <Select
                name={`${p}.op`}
                label="Bedingung"
                disabled={disabled}
                defaultValue={r.op}
                onChange={(e) => set({ op: e.target.value })}
                options={(hydrated
                  ? RULE_OPS.filter((o) => allowed.includes(o.value))
                  : RULE_OPS
                ).map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
              />
              {hydrated && def.type === "enum" ? (
                <Select
                  name={`${p}.value`}
                  label="Wert"
                  disabled={disabled}
                  defaultValue={r.value}
                  onChange={(e) => set({ value: e.target.value })}
                  placeholder="Wert wählen"
                  options={(def as { options: readonly string[] }).options.map((o) => ({
                    value: o,
                    label: ENUM_LABELS[o] ?? o,
                  }))}
                />
              ) : hydrated && def.type === "boolean" ? (
                <Select
                  name={`${p}.value`}
                  label="Wert"
                  disabled={disabled}
                  defaultValue={r.value || "true"}
                  onChange={(e) => set({ value: e.target.value })}
                  options={[
                    { value: "true", label: "ja" },
                    { value: "false", label: "nein" },
                  ]}
                />
              ) : (
                <Field
                  name={`${p}.value`}
                  label="Wert"
                  disabled={disabled}
                  defaultValue={r.value}
                  onChange={(e) => set({ value: e.target.value })}
                  inputMode={def.type === "number" ? "decimal" : undefined}
                  suffix={def.type === "number" ? "€" : undefined}
                  hint={
                    hydrated
                      ? def.type === "number"
                        ? "Preis der günstigsten aktiven Variante"
                        : undefined
                      : "Status: active, draft, archived · Art: simple, bundle · Lebensmittel: true, false · Preis in Euro"
                  }
                />
              )}
              <div className="sm:pt-6">
                {hydrated ? (
                  <Button
                    variant="text"
                    icon="schliessen"
                    aria-label={`Bedingung ${i + 1} entfernen`}
                    disabled={disabled}
                    onClick={() => update(rows.filter((x) => x.key !== r.key))}
                  >
                    <span className="sm:sr-only">Entfernen</span>
                  </Button>
                ) : !r.isNew ? (
                  <StateCheckbox name={`${p}.remove`} label="Entfernen" />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {hydrated && !disabled ? (
        <div>
          <Button
            variant="text"
            icon="plus"
            onClick={() => {
              const list = [
                ...rows,
                { key: seq.current++, field: "tag" as RuleField, op: "eq", value: "" },
              ];
              setRows(list);
              ref.current?.dispatchEvent(new Event("input", { bubbles: true }));
            }}
          >
            Bedingung hinzufügen
          </Button>
        </div>
      ) : null}

      <section
        aria-labelledby="regel-vorschau"
        className="rounded-admin-feld bg-admin-flaeche p-3"
        aria-busy={pending}
      >
        <h3 id="regel-vorschau" className="flex items-center gap-2 text-[14px] font-semibold">
          Vorschau
          <Badge tone="blue" noDot>
            {result.ok ? `${result.total} Produkte passen` : "Bedingung prüfen"}
          </Badge>
          {pending ? (
            <span className="text-admin-text-2 text-[12px] font-normal">wird berechnet …</span>
          ) : null}
        </h3>
        {!result.ok ? (
          <p className="text-admin-rot mt-2 flex items-center gap-1 text-[13px]" role="alert">
            <Icon name="warnung" size={14} />
            {Object.values(result.fieldErrors)[0] ?? result.message}
          </p>
        ) : result.items.length ? (
          <ul className="mt-2 flex flex-col gap-1.5" aria-live="polite">
            {result.items.slice(0, 50).map((it) => (
              <li
                key={it.id}
                className="bg-admin-karte rounded-admin-feld flex items-center gap-3 px-2 py-1.5"
              >
                <span className="bg-admin-flaeche rounded-admin-feld flex size-9 shrink-0 items-center justify-center overflow-hidden">
                  {it.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={it.imageUrl}
                      alt=""
                      className="size-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <Icon name="bild" size={16} />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{it.title}</span>
                {it.status !== "active" ? (
                  <Badge tone="gray" hollow={it.status === "archived"}>
                    {ENUM_LABELS[it.status]}
                  </Badge>
                ) : null}
                <span className="text-admin-text-2 text-[13px] tabular-nums">
                  {it.priceCents != null ? formatMoney(it.priceCents) : "–"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-admin-text-2 mt-2 text-[13px]">
            Kein Produkt erfüllt alle Bedingungen.
          </p>
        )}
        <p className="text-admin-text-2 mt-2 text-[12px]">
          Gespeichert wird die Zuordnung beim Speichern; danach rechnet der Shop sie nach jeder
          Produktänderung neu.
        </p>
      </section>
    </div>
  );
}
