import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { createLegalDraftAction } from "@/lib/admin/content/actions";
import type { DiffOp, WordSegment } from "@/lib/admin/content/diff";
import {
  compareLegalVersions,
  LEGAL_KIND_LABELS,
  LEGAL_KINDS,
  listLegalVersions,
  type LegalVersionSummary,
} from "@/lib/admin/content/legal";
import type { LegalKind } from "@/lib/content/legal";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { Hint } from "@/components/admin/content/parts";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { cx } from "@/components/admin/ui/cx";
import { Field, Select } from "@/components/admin/ui/fields";
import { formatDate } from "@/components/admin/ui/format";
import { firstParam, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

export const metadata: Metadata = { title: "Versionen vergleichen" };

/**
 * /admin/inhalte/rechtstexte/[kind]/vergleich?alt=&neu= (Figma 42:2737): Absatzvergleich zweier
 * Versionen über diff.ts. Unveränderte Absätze sind eingeklappt, geänderte zeigen den Wortvergleich.
 */
export default async function LegalComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { kind: rawKind } = await params;
  if (!(LEGAL_KINDS as readonly string[]).includes(rawKind)) notFound();
  const kind = rawKind as LegalKind;
  const base = `/admin/inhalte/rechtstexte/${kind}`;
  const path = `${base}/vergleich`;
  const session = await requireStaff("support", { next: path });
  const canEdit = PERMISSIONS.editContent(session);
  const sp = await searchParams;
  const versions = await listLegalVersions(kind);
  const byId = new Map(versions.map((v) => [v.id, v]));
  const draft = versions.find((v) => v.status === "draft");
  const current = versions.find((v) => v.isCurrent);
  const newer = byId.get(firstParam(sp.neu) ?? "") ?? draft ?? current ?? versions[0];
  const olderParam = byId.get(firstParam(sp.alt) ?? "");
  const older =
    olderParam ??
    (newer && newer.id !== current?.id
      ? current
      : versions.find((v) => v.version < (newer?.version ?? 0)));
  const label = LEGAL_KIND_LABELS[kind];

  if (!newer || !older || newer.id === older.id) {
    return (
      <>
        <PageHeader
          title="Versionen vergleichen"
          backHref={base}
          backLabel={`${label} bearbeiten`}
        />
        <Hint>Für einen Vergleich braucht es mindestens zwei verschiedene Versionen.</Hint>
      </>
    );
  }

  const result = await compareLegalVersions({ newVersionId: newer.id, oldVersionId: older.id });
  const { summary } = result.diff;
  const summaryText = [
    summary.changed
      ? `${summary.changed} ${summary.changed === 1 ? "Absatz" : "Absätze"} geändert`
      : "nichts geändert",
    summary.removed ? `${summary.removed} entfernt` : "nichts entfernt",
    summary.added ? `${summary.added} hinzugefügt` : "nichts hinzugefügt",
  ].join(", ");

  const optionLabel = (v: LegalVersionSummary) =>
    `Version ${v.version} · ${v.status === "draft" ? `Entwurf ${formatDate(v.createdAt)}` : `veröffentlicht ${formatDate(v.publishedAt ?? v.effectiveFrom)}`}`;
  const options = versions.map((v) => ({ value: v.id, label: optionLabel(v) }));

  return (
    <>
      <PageHeader
        title="Versionen vergleichen"
        backHref={base}
        backLabel={`${label} bearbeiten`}
        description={`${label} · ${summaryText}`}
        actions={
          <>
            {canEdit && !draft && older.status === "published" && !older.isCurrent ? (
              <InlineAction
                action={createLegalDraftAction}
                fields={{ kind, basedOnVersionId: older.id }}
                label={`Version ${older.version} wiederherstellen`}
                size="md"
                confirm={{
                  title: `Version ${older.version} wiederherstellen?`,
                  description:
                    "Legt den alten Text als neue Version (Entwurf) an. Nichts wird überschrieben.",
                  confirmLabel: "Als Entwurf anlegen",
                }}
              >
                <Field
                  name="changeNote"
                  label="Änderungsvermerk"
                  defaultValue={`Wiederhergestellt aus Version ${older.version}`}
                />
              </InlineAction>
            ) : null}
            {canEdit && newer.status === "draft" ? (
              <ButtonLink href={base} variant="primary">
                Version {newer.version} prüfen und veröffentlichen
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <form
        method="get"
        action={path}
        className="mb-4 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
      >
        <Select name="alt" label="Alt" defaultValue={older.id} options={options} />
        <span className="text-admin-text-2 hidden h-10 items-center md:flex" aria-hidden="true">
          →
        </span>
        <Select name="neu" label="Neu" defaultValue={newer.id} options={options} />
        <SubmitButton variant="secondary">Vergleichen</SubmitButton>
      </form>

      <div className="text-admin-text-2 mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="bg-admin-rot-hell text-admin-rot rounded px-1.5 py-0.5 line-through">
          entfernt
        </span>
        <span className="bg-admin-gruen-hell text-admin-gruen rounded px-1.5 py-0.5">
          hinzugefügt
        </span>
        <span>Unveränderte Absätze sind eingeklappt, ein Klick auf „…“ blendet sie ein.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <VersionHead v={older} side="alt" />
        <VersionHead v={newer} side="neu" className="max-md:hidden" />
      </div>
      <Card className="mt-3" flush>
        <ol className="divide-admin-rahmen divide-y">
          {groupOps(result.diff.ops).map((g, i) =>
            g.type === "equal" ? (
              <li key={i} className="px-4 py-2">
                <details>
                  <summary className="bg-admin-flaeche text-admin-text-2 hover:text-admin-text inline-flex min-h-11 cursor-pointer list-none items-center rounded px-2 text-[12px] md:min-h-0 md:py-0.5 [&::-webkit-details-marker]:hidden">
                    … {g.ops.length} unveränderte {g.ops.length === 1 ? "Absatz" : "Absätze"}
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {g.ops.map((op, j) => (
                      <Row key={j} op={op} />
                    ))}
                  </div>
                </details>
              </li>
            ) : (
              <li key={i} className="px-4 py-3">
                <Row op={g.op} />
              </li>
            ),
          )}
        </ol>
      </Card>
      <Hint className="mt-4">
        Die neuen Formulierungen sind Entwürfe für die Rechtsprüfung
        (docs/rechtstexte-aenderungen.md). Wiederherstellen legt eine ältere Fassung als neue
        Version an, nichts wird überschrieben.
      </Hint>
    </>
  );
}

type Group = { type: "equal"; ops: DiffOp[] } | { type: "op"; op: DiffOp };

function groupOps(ops: DiffOp[]): Group[] {
  const out: Group[] = [];
  for (const op of ops) {
    const last = out[out.length - 1];
    if (op.type === "equal") {
      if (last?.type === "equal") last.ops.push(op);
      else out.push({ type: "equal", ops: [op] });
    } else out.push({ type: "op", op });
  }
  return out;
}

function VersionHead({
  v,
  side,
  className,
}: {
  v: LegalVersionSummary;
  side: "alt" | "neu";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-admin-karte border-admin-rahmen bg-admin-karte border px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-bold">
          Version {v.version} ({side})
        </p>
        {v.status === "draft" ? (
          <Badge tone="gray">Entwurf</Badge>
        ) : v.isCurrent ? (
          <Badge tone="green">Veröffentlicht, live</Badge>
        ) : (
          <Badge tone="gray" hollow>
            Veröffentlicht
          </Badge>
        )}
      </div>
      <p className="text-admin-text-2 mt-1 text-[12px]">
        {v.status === "draft"
          ? `Entwurf ${formatDate(v.createdAt)}`
          : `veröffentlicht ${formatDate(v.publishedAt)}`}
        {" · "}
        {v.createdByName ?? "Import"}
        {v.changeNote ? ` · ${v.changeNote}` : ""}
      </p>
    </div>
  );
}

function Words({ words, side }: { words: WordSegment[]; side: "old" | "new" }) {
  return (
    <>
      {words.map((w, i) => {
        if (w.type === "equal") return <span key={i}>{w.text} </span>;
        if (side === "old" && w.type === "removed")
          return (
            <del key={i} className="bg-admin-rot-hell text-admin-rot rounded-sm">
              {w.text}{" "}
            </del>
          );
        if (side === "new" && w.type === "added")
          return (
            <ins key={i} className="bg-admin-gruen-hell text-admin-gruen rounded-sm no-underline">
              {w.text}{" "}
            </ins>
          );
        return null;
      })}
    </>
  );
}

function Cell({
  tone,
  children,
  label,
}: {
  tone: "plain" | "removed" | "added" | "empty";
  children?: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className={cx(
        "rounded-admin-feld min-w-0 text-[14px] leading-[1.6]",
        tone === "removed" &&
          "bg-admin-rot-hell text-admin-rot admin-diff-entfernt border-admin-rot border-l-4 px-3 py-2",
        tone === "added" &&
          "bg-admin-gruen-hell border-admin-gruen text-admin-gruen border-l-4 px-3 py-2",
        tone === "empty" && "max-md:hidden",
      )}
    >
      <span className="text-admin-text-2 mb-0.5 block text-[11px] font-medium tracking-wide uppercase md:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

function Row({ op }: { op: DiffOp }) {
  const heading = (tag: string) => /^h[1-6]$/.test(tag);
  if (op.type === "equal")
    return (
      <div className="text-admin-text-2 grid gap-2 text-[14px] md:grid-cols-2 md:gap-6">
        <p className={cx(heading(op.old.tag) && "text-admin-text font-bold")}>{op.old.text}</p>
        <p className={cx("max-md:hidden", heading(op.new.tag) && "text-admin-text font-bold")}>
          {op.new.text}
        </p>
      </div>
    );
  if (op.type === "removed")
    return (
      <div className="grid gap-2 md:grid-cols-2 md:gap-6">
        <Cell tone="removed" label="Alt, entfernt">
          {op.old.text}
        </Cell>
        <Cell tone="empty" label="Neu" />
      </div>
    );
  if (op.type === "added")
    return (
      <div className="grid gap-2 md:grid-cols-2 md:gap-6">
        <Cell tone="empty" label="Alt" />
        <Cell tone="added" label="Neu, hinzugefügt">
          {op.new.text}
        </Cell>
      </div>
    );
  return (
    <div className="grid gap-2 md:grid-cols-2 md:gap-6">
      <Cell tone="plain" label="Alt">
        <Words words={op.words} side="old" />
      </Cell>
      <Cell tone="plain" label="Neu">
        <Words words={op.words} side="new" />
      </Cell>
    </div>
  );
}
