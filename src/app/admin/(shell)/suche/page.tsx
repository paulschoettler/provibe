import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { normalizeQuery, searchBackoffice, type SearchResults } from "@/lib/admin/dashboard/search";
import { Badge, StatusBadge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { formatDate, formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";

export const metadata: Metadata = { title: "Suche" };

/**
 * /admin/suche?q= (Ziel des Suchfelds in der Kopfzeile, ⌘K). Vorerst einfache Treffer über
 * Bestellnummer, Bestell- und Kunden-E-Mail, Kundenname und Produkt (Titel, Handle, SKU).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireStaff("support", { next: "/admin/suche" });
  const q = normalizeQuery((await searchParams).q);
  const canSeeCustomers = PERMISSIONS.viewCustomers(session);
  let results: SearchResults | null = null;
  let failed = false;
  if (q.length >= 2) {
    try {
      results = await searchBackoffice(q, { customers: canSeeCustomers });
    } catch (error) {
      console.error("[admin] Suche", error);
      failed = true;
    }
  }
  const total = results
    ? results.orders.length + results.customers.length + results.products.length
    : 0;

  return (
    <>
      <PageHeader
        title="Suche"
        description="Bestellungen, Kunden und Produkte an einem Ort finden."
      />
      <form action="/admin/suche" method="get" role="search" className="mb-5 flex gap-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Suchbegriff</span>
          <span className="text-admin-text-2 pointer-events-none absolute left-3">
            <Icon name="suche" size={18} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus={!q}
            placeholder="Bestellnummer, E-Mail, Name oder Produkt"
            className="rounded-admin-feld border-admin-rahmen-stark bg-admin-karte focus-visible:border-admin-akzent h-11 w-full border pr-3 pl-10 text-[15px] focus-visible:border-2 focus-visible:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-admin-badge bg-admin-akzent text-admin-auf-akzent hover:bg-admin-akzent-hover h-11 px-5 text-[14px] font-semibold"
        >
          Suchen
        </button>
      </form>

      {failed ? (
        <EmptyState icon="warnung" title="Die Suche hat gerade nicht geklappt">
          Bitte versuch es noch einmal.
        </EmptyState>
      ) : q.length < 2 ? (
        <EmptyState icon="suche" title="Wonach suchst du?">
          Mindestens zwei Zeichen, zum Beispiel PV-010001, eine E-Mail-Adresse oder
          &bdquo;Peach&ldquo;.
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState icon="suche" title={`Keine Treffer für „${q}“`}>
          Prüfe die Schreibweise oder suche nach einem Teil der Nummer oder Adresse.
        </EmptyState>
      ) : results ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ResultCard title="Bestellungen" count={results.orders.length}>
            {results.orders.map((o) => (
              <ResultRow
                key={o.id}
                href={`/admin/bestellungen/${o.id}`}
                title={o.orderNumber}
                meta={`${o.email} · ${formatDate(o.placedAt)}`}
                aside={
                  <>
                    {o.isTest ? <Badge tone="gray">Test</Badge> : null}
                    <StatusBadge kind="order" value={o.status} />
                    <span className="font-medium tabular-nums">{formatMoney(o.totalCents)}</span>
                  </>
                }
              />
            ))}
          </ResultCard>
          {canSeeCustomers ? (
            <ResultCard title="Kunden" count={results.customers.length}>
              {results.customers.map((c) => (
                <ResultRow
                  key={c.id}
                  href={`/admin/kunden/${c.id}`}
                  title={c.name || c.email}
                  meta={c.name ? c.email : undefined}
                  aside={<span className="text-admin-text-2">{c.ordersCount} Bestellungen</span>}
                />
              ))}
            </ResultCard>
          ) : null}
          <ResultCard title="Produkte" count={results.products.length}>
            {results.products.map((p) => (
              <ResultRow
                key={p.id}
                href={`/admin/produkte/${p.id}`}
                title={p.title}
                meta={p.handle}
                aside={<StatusBadge kind="record" value={p.status} />}
              />
            ))}
          </ResultCard>
        </div>
      ) : null}
    </>
  );
}

function ResultCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Card title={`${title} (${count})`} flush>
      {count === 0 ? (
        <p className="text-admin-text-2 px-4 pb-4 text-[14px]">Keine Treffer.</p>
      ) : (
        <ul className="border-admin-rahmen border-t">{children}</ul>
      )}
    </Card>
  );
}

function ResultRow({
  href,
  title,
  meta,
  aside,
}: {
  href: string;
  title: string;
  meta?: string;
  aside?: ReactNode;
}) {
  return (
    <li className="border-admin-rahmen border-b last:border-b-0">
      <Link
        href={href}
        className="hover:bg-admin-flaeche flex min-h-[52px] items-center gap-3 px-4 py-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{title}</span>
          {meta ? (
            <span className="text-admin-text-2 block truncate text-[13px]">{meta}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[13px]">{aside}</span>
      </Link>
    </li>
  );
}
