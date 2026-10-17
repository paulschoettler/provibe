"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { renderDraftPreview, saveCampaignAction } from "@/lib/admin/newsletter/ui-actions";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  applyIntent,
  blockSummary,
  type BlockType,
  type DraftBlock,
  type EditorIntent,
} from "@/lib/admin/newsletter/editor-form";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { INITIAL_ACTION_STATE } from "@/components/admin/ui/action-state";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { cx } from "@/components/admin/ui/cx";
import { Field, Select, Textarea, type SelectOption } from "@/components/admin/ui/fields";
import { Icon, type IconName } from "@/components/admin/ui/Icon";

/**
 * Block-Editor einer Kampagne (Figma 39:1619, mobil 35:13134): Blöcke links, Live-Vorschau in der
 * Mitte (serverseitig gerendert, iframe srcdoc), Einstellungen rechts. Hinzufügen, Verschieben und
 * Entfernen laufen mit JavaScript sofort im Browser, ohne JavaScript über dieselben Buttons als
 * Server Action (name="intent"). Gespeichert wird nur mit "Entwurf speichern".
 */

export interface CampaignEditorProps {
  campaignId: string;
  meta: { name: string; subject: string; preheader: string; replyTo: string; segmentId: string };
  blocks: DraftBlock[];
  segments: SelectOption[];
  audience: Record<string, string>;
  products: SelectOption[];
  productNames: Record<string, string>;
  fromEmail: string;
  initialHtml: string;
  /** Rechte Spalte unter den Einstellungen (Testversand, Planung), serverseitig gerendert */
  aside?: ReactNode;
}

const FORM_ID = "kampagne-editor";
const ICONS: Record<BlockType, IconName> = {
  text: "notiz",
  image: "bild",
  product: "produkte",
  button: "link",
  divider: "liste",
};

type Meta = CampaignEditorProps["meta"];

export function CampaignEditor(props: CampaignEditorProps) {
  const [state, formAction, pending] = useActionState(saveCampaignAction, INITIAL_ACTION_STATE);
  const fromState = state.data?.blocks as DraftBlock[] | undefined;
  const metaFromState = state.data?.meta as Partial<Meta> | undefined;
  const [blocks, setBlocks] = useState<DraftBlock[]>(() => fromState ?? props.blocks);
  const [meta, setMeta] = useState<Meta>(() => ({ ...props.meta, ...metaFromState }));
  const [focus, setFocus] = useState<number | null>(
    () => (state.data?.focus as number | null | undefined) ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [html, setHtml] = useState(props.initialHtml);
  const [skipped, setSkipped] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const savedRef = useRef<unknown>(null);
  const firstRender = useRef(true);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state.status === "ok" && state.data?.saved && savedRef.current !== state.data.saved) {
      savedRef.current = state.data.saved;
      setDirty(false);
    }
  }, [state]);

  // Live-Vorschau: 400 ms nach der letzten Änderung serverseitig rendern
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(async () => {
      const res = await renderDraftPreview({
        campaignId: props.campaignId,
        subject: meta.subject,
        preheader: meta.preheader || null,
        blocks,
      });
      if ("html" in res) {
        setHtml(res.html);
        setSkipped(res.skipped);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [blocks, meta.subject, meta.preheader, props.campaignId]);

  // Fokus auf den neuen oder verschobenen Block
  useEffect(() => {
    if (focus === null) return;
    document.getElementById(`block-${focus}`)?.scrollIntoView({ block: "nearest" });
  }, [focus, blocks.length]);

  const run = (intent: EditorIntent) => {
    const next = applyIntent(blocks, intent);
    setBlocks(next.blocks);
    setFocus(next.focus);
    setDirty(true);
  };
  const update = (index: number, patch: Partial<DraftBlock>) => {
    setBlocks((list) => list.map((b, i) => (i === index ? ({ ...b, ...patch } as DraftBlock) : b)));
    setDirty(true);
  };
  const setMetaField = (key: keyof Meta, value: string) => {
    setMeta((m) => ({ ...m, [key]: value }));
    setDirty(true);
  };
  const intentButton = (intent: string, parsed: EditorIntent) => ({
    type: "submit" as const,
    form: FORM_ID,
    name: "intent",
    value: intent,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      run(parsed);
    },
  });
  const err = (name: string) => errors[name];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-admin-karte border-admin-rahmen bg-admin-karte sticky top-[64px] z-20 flex flex-wrap items-center gap-3 border px-3 py-2 md:top-[64px]">
        <p
          className="text-admin-text-2 min-w-0 flex-1 text-[13px]"
          role="status"
          aria-live="polite"
        >
          {pending
            ? "Wird gespeichert …"
            : dirty
              ? "Ungespeicherte Änderungen. Testversand und Planung nutzen den gespeicherten Stand."
              : "Alle Änderungen gespeichert."}
        </p>
        <Button
          type="submit"
          form={FORM_ID}
          name="intent"
          value="save"
          variant="primary"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          Entwurf speichern
        </Button>
      </div>
      {state.status === "error" && state.message ? (
        <FormMessage tone="error" className="mb-0">
          {state.message}
          {Object.keys(errors).some((k) => k.startsWith("blocks."))
            ? " Die betroffenen Blöcke sind markiert."
            : ""}
        </FormMessage>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,320px)]">
        {/* Blöcke */}
        <form
          id={FORM_ID}
          action={formAction}
          noValidate
          className="order-2 flex min-w-0 flex-col gap-3 xl:order-1"
          aria-label="Blöcke der Kampagne"
        >
          <input type="hidden" name="campaignId" value={props.campaignId} />
          <Card title="Blöcke" description="Antippen fügt den Block am Ende ein">
            <div className="grid grid-cols-5 gap-2 xl:grid-cols-1">
              {BLOCK_TYPES.map((t) => (
                <button
                  key={t}
                  {...intentButton(`add:${t}`, { kind: "add", type: t })}
                  className="rounded-admin-feld border-admin-rahmen-stark hover:bg-admin-flaeche flex min-h-11 flex-col items-center justify-center gap-1 border px-1 py-2 text-[12px] font-medium xl:flex-row xl:justify-start xl:gap-2 xl:px-3 xl:text-[14px]"
                >
                  <Icon name={ICONS[t]} size={18} />
                  {BLOCK_LABELS[t]}
                </button>
              ))}
            </div>
          </Card>
          <section aria-labelledby="aufbau-titel" className="flex flex-col gap-2">
            <h2 id="aufbau-titel" className="px-1 text-[16px] font-semibold">
              Aufbau{" "}
              <span className="text-admin-text-2 text-[13px] font-normal">
                {blocks.length} Blöcke, Fuß mit Abmeldelink ist Pflicht
              </span>
            </h2>
            {blocks.length === 0 ? (
              <p className="text-admin-text-2 rounded-admin-karte border-admin-rahmen bg-admin-karte border p-4 text-[13px]">
                Noch keine Blöcke. Füge oben einen Text oder ein Produkt hinzu.
              </p>
            ) : null}
            {blocks.map((b, i) => {
              const hasError = Object.keys(errors).some((k) => k.startsWith(`blocks.${i}.`));
              return (
                <div
                  key={b.id}
                  id={`block-${i}`}
                  className={cx(
                    "rounded-admin-karte bg-admin-karte flex flex-col gap-3 border p-3",
                    hasError
                      ? "border-admin-rot border-2"
                      : focus === i
                        ? "border-admin-akzent"
                        : "border-admin-rahmen",
                  )}
                  onFocusCapture={() => setFocus(i)}
                >
                  <input type="hidden" name={`blocks.${i}.id`} value={b.id} />
                  <input type="hidden" name={`blocks.${i}.type`} value={b.type} />
                  <div className="flex items-center gap-2">
                    <Icon name={ICONS[b.type]} size={18} />
                    <p className="min-w-0 flex-1 truncate text-[14px]">
                      <span className="font-semibold">{BLOCK_LABELS[b.type]}</span>
                      <span className="text-admin-text-2">
                        {" "}
                        · {blockSummary(b, props.productNames)}
                      </span>
                    </p>
                    <span className="flex shrink-0">
                      <button
                        {...intentButton(`up:${i}`, { kind: "up", index: i })}
                        disabled={i === 0}
                        aria-label={`${BLOCK_LABELS[b.type]} ${i + 1} nach oben`}
                        className="hover:bg-admin-flaeche flex size-11 items-center justify-center rounded disabled:opacity-30 md:size-8"
                      >
                        <Icon name="chevron-unten" size={16} className="rotate-180" />
                      </button>
                      <button
                        {...intentButton(`down:${i}`, { kind: "down", index: i })}
                        disabled={i === blocks.length - 1}
                        aria-label={`${BLOCK_LABELS[b.type]} ${i + 1} nach unten`}
                        className="hover:bg-admin-flaeche flex size-11 items-center justify-center rounded disabled:opacity-30 md:size-8"
                      >
                        <Icon name="chevron-unten" size={16} />
                      </button>
                      <button
                        {...intentButton(`remove:${i}`, { kind: "remove", index: i })}
                        aria-label={`${BLOCK_LABELS[b.type]} ${i + 1} entfernen`}
                        className="text-admin-rot hover:bg-admin-rot-hell flex size-11 items-center justify-center rounded md:size-8"
                      >
                        <Icon name="schliessen" size={16} />
                      </button>
                    </span>
                  </div>
                  <BlockFields
                    block={b}
                    index={i}
                    products={props.products}
                    error={err}
                    onChange={(patch) => update(i, patch)}
                  />
                </div>
              );
            })}
          </section>
        </form>

        {/* Vorschau */}
        <section
          aria-labelledby="vorschau-titel"
          className="order-1 flex min-w-0 flex-col gap-2 xl:order-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="vorschau-titel" className="sr-only">
              Vorschau
            </h2>
            <div
              className="rounded-admin-feld bg-admin-flaeche flex p-1"
              role="group"
              aria-label="Vorschaubreite"
            >
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={device === d}
                  onClick={() => setDevice(d)}
                  className={cx(
                    "flex h-9 items-center gap-1.5 rounded-[6px] px-3 text-[14px]",
                    device === d ? "bg-admin-karte font-semibold shadow-sm" : "text-admin-text-2",
                  )}
                >
                  <Icon name={d === "desktop" ? "dashboard" : "handy"} size={16} />
                  {d === "desktop" ? "Desktop" : "Mobil"}
                </button>
              ))}
            </div>
            <p className="text-admin-text-2 text-[13px]">
              {device === "desktop" ? "600 px" : "375 px"} · Brand-Vorlage, aktuelle Katalogpreise
              {skipped ? ` · ${skipped} unvollständige Blöcke ausgelassen` : ""}
            </p>
          </div>
          <div className="rounded-admin-karte bg-admin-flaeche flex justify-center overflow-x-auto p-2 md:p-4">
            <iframe
              title="Vorschau der Kampagne"
              srcDoc={html}
              sandbox=""
              referrerPolicy="no-referrer"
              className="rounded-admin-feld border-admin-rahmen h-[760px] max-w-full border bg-white"
              style={{ width: device === "desktop" ? 640 : 375 }}
            />
          </div>
        </section>

        {/* Einstellungen */}
        <div className="order-3 flex min-w-0 flex-col gap-4">
          <Card title="E-Mail">
            <div className="flex flex-col gap-3">
              <Field
                name="name"
                form={FORM_ID}
                label="Interner Name"
                value={meta.name}
                onChange={(e) => setMetaField("name", e.target.value)}
                error={err("name")}
                maxLength={120}
                required
              />
              <Field
                name="subject"
                form={FORM_ID}
                label="Betreff"
                value={meta.subject}
                onChange={(e) => setMetaField("subject", e.target.value)}
                error={err("subject")}
                maxLength={150}
                required
              />
              <Field
                name="preheader"
                form={FORM_ID}
                label="Vorschautext"
                hint="Erscheint im Postfach neben dem Betreff"
                value={meta.preheader}
                onChange={(e) => setMetaField("preheader", e.target.value)}
                error={err("preheader")}
                maxLength={200}
              />
              <Field
                name="fromEmail"
                label="Absender"
                value={props.fromEmail}
                readOnly
                disabled
                hint="Fest die Newsletter-Adresse mit DKIM bei Resend"
              />
              <Field
                name="replyTo"
                form={FORM_ID}
                label="Antwort an"
                type="email"
                value={meta.replyTo}
                onChange={(e) => setMetaField("replyTo", e.target.value)}
                error={err("replyTo")}
              />
            </div>
          </Card>
          <Card title="Zielgruppe">
            <div className="flex flex-col gap-2">
              <Select
                name="segmentId"
                form={FORM_ID}
                label="Segment"
                value={meta.segmentId}
                onChange={(e) => setMetaField("segmentId", e.target.value)}
                options={[{ value: "", label: "Alle mit Einwilligung" }, ...props.segments]}
              />
              <p className="text-admin-text-2 text-[13px]">
                {props.audience[meta.segmentId || "alle"] ??
                  "Zielgruppe wird beim Speichern berechnet."}
              </p>
            </div>
          </Card>
          {props.aside}
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  index,
  products,
  error,
  onChange,
}: {
  block: DraftBlock;
  index: number;
  products: SelectOption[];
  error: (name: string) => string | undefined;
  onChange: (patch: Partial<DraftBlock>) => void;
}) {
  const n = (field: string) => `blocks.${index}.${field}`;
  switch (block.type) {
    case "text":
      return (
        <>
          <Field
            name={n("heading")}
            label="Überschrift"
            value={block.heading}
            maxLength={160}
            error={error(n("heading"))}
            onChange={(e) => onChange({ heading: e.target.value })}
          />
          <Textarea
            name={n("body")}
            label="Text"
            hint="Leerzeile trennt Absätze"
            rows={4}
            value={block.body}
            maxLength={10000}
            error={error(n("body"))}
            onChange={(e) => onChange({ body: e.target.value })}
          />
        </>
      );
    case "image":
      return (
        <>
          <Field
            name={n("src")}
            label="Bild"
            hint="https-Adresse, /pfad der Website oder Pfad im Medien-Bucket"
            value={block.src}
            error={error(n("src"))}
            onChange={(e) => onChange({ src: e.target.value })}
          />
          <Field
            name={n("alt")}
            label="Alt-Text"
            hint="Pflicht: beschreibt das Bild für Screenreader"
            value={block.alt}
            maxLength={300}
            error={error(n("alt"))}
            onChange={(e) => onChange({ alt: e.target.value })}
          />
          <Field
            name={n("href")}
            label="Link (optional)"
            value={block.href}
            error={error(n("href"))}
            onChange={(e) => onChange({ href: e.target.value })}
          />
        </>
      );
    case "product": {
      const value = block.variantId
        ? `${block.productHandle}:${block.variantId}`
        : block.productHandle;
      return (
        <Select
          name={n("productHandle")}
          label="Produkt"
          hint="Preis, Pfand und Grundpreis kommen beim Versand aktuell aus dem Katalog"
          value={value}
          placeholder="Produkt wählen"
          options={products}
          error={error(n("productHandle"))}
          onChange={(e) => {
            const [handle, variant] = e.target.value.split(":");
            onChange({ productHandle: handle ?? "", variantId: variant ?? "" });
          }}
        />
      );
    }
    case "button":
      return (
        <>
          <Field
            name={n("label")}
            label="Beschriftung"
            value={block.label}
            maxLength={60}
            error={error(n("label"))}
            onChange={(e) => onChange({ label: e.target.value })}
          />
          <Field
            name={n("href")}
            label="Link"
            hint="https://, mailto: oder /pfad"
            value={block.href}
            error={error(n("href"))}
            onChange={(e) => onChange({ href: e.target.value })}
          />
        </>
      );
    case "divider":
      return <p className="text-admin-text-2 text-[13px]">Trennlinie zwischen zwei Abschnitten.</p>;
  }
}
