import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import {
  getCustomerProfile,
  getCustomerSubscriptions,
  listCustomerTags,
  type CustomerOrderRow,
  type CustomerProfile,
  type CustomerSubscriptionRow,
} from "@/lib/admin/customers/queries";
import { ACCOUNT_STATUS_LABEL, type TimelineEntry } from "@/lib/admin/customers/profile";
import { ERASURE_RULES } from "@/lib/admin/customers/erasure";
import { deriveOrderBadges, type OrderStatus, type PaymentStatus } from "@/lib/admin/orders/status";
import { NoAccess } from "@/components/admin/NoAccess";
import { FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink, buttonClasses } from "@/components/admin/ui/Button";
import { Card, cardActionClass } from "@/components/admin/ui/Card";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { formatDate, formatDateTime, formatMoney } from "@/components/admin/ui/format";
import { firstParam, type SearchParamsInput } from "@/components/admin/ui/href";
import { Icon, type IconName } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Tabs } from "@/components/admin/ui/Tabs";
import { Timeline, type TimelineItem } from "@/components/admin/ui/Timeline";
import { AccountBadge, NewsletterBadge } from "@/components/admin/crm/badges";
import { CustomerActions } from "@/components/admin/crm/CustomerActions";
import { NoteForm, NoteList } from "@/components/admin/crm/NoteForm";
import { InfoList, KpiCard, Notice } from "@/components/admin/crm/parts";
import { TagEditor } from "@/components/admin/crm/TagEditor";
import { UnsubscribeDialog } from "@/components/admin/crm/UnsubscribeDialog";

export const metadata: Metadata = { title: "Kunde" };

const UUID = /^[0-9a-f-]{36}$/i;
const TABS = [
  { key: "uebersicht", label: "Übersicht" },
  { key: "bestellungen", label: "Bestellungen" },
  { key: "newsletter", label: "Newsletter-Nachweis" },
  { key: "notizen", label: "Tags und Notizen" },
  { key: "aktivitaet", label: "Timeline" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SOURCE_ICON: Record<TimelineEntry["source"], IconName> = {
  customer: "kunden",
  order: "bestellungen",
  newsletter: "newsletter",
  note: "notiz",
  email: "emails",
};

const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: "aktiv",
  paused: "pausiert",
  past_due: "Zahlung offen",
  cancelled: "gekündigt",
  incomplete: "unvollständig",
};

/**
 * /admin/kunden/[id] (Figma 29:6892, mobil 27:5066): Kopf mit Tags und Aktionen, Kennzahlen,
 * Tabs Übersicht, Bestellungen, Newsletter-Nachweis, Tags und Notizen, Timeline.
 * Support liest alles und schreibt Tags und Notizen; Sperren und Löschen nur Owner und Admin.
 */
export default async function KundeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { id } = await params;
  const path = `/admin/kunden/${id}`;
  const session = await requireStaff("support", { next: path });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const tabRaw = firstParam(sp.tab);
  const tab: TabKey = TABS.some((t) => t.key === tabRaw) ? (tabRaw as TabKey) : "uebersicht";

  let profile: CustomerProfile | null = null;
  let subscriptions: CustomerSubscriptionRow[] = [];
  let tagSuggestions: string[] = [];
  try {
    [profile, subscriptions, tagSuggestions] = await Promise.all([
      getCustomerProfile(id),
      getCustomerSubscriptions(id),
      listCustomerTags().catch(() => []),
    ]);
  } catch (error) {
    console.error("[admin] Kundenprofil", error);
    return (
      <>
        <PageHeader title="Kunde" backHref="/admin/kunden" backLabel="Kunden" />
        <FormMessage tone="error">Das Profil konnte gerade nicht geladen werden.</FormMessage>
      </>
    );
  }
  if (!profile) notFound();
  const p = profile;
  const canManage = session.role === "owner" || session.role === "admin";
  const anonymized = p.account.status === "anonymized";
  const blocked = p.account.status === "blocked";

  const tabItems = TABS.map((t) => ({
    label: t.label,
    href: t.key === "uebersicht" ? path : `${path}?tab=${t.key}`,
    active: tab === t.key,
    count:
      t.key === "bestellungen" ? p.orders.length : t.key === "notizen" ? p.notes.length : undefined,
  }));

  return (
    <>
      <PageHeader
        backHref="/admin/kunden"
        backLabel="Kunden"
        title={
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-admin-akzent-hell text-admin-akzent flex size-12 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold md:size-14 md:text-[18px]"
            >
              {p.initials}
            </span>
            <span className="min-w-0 break-words">{p.name}</span>
          </span>
        }
        description={
          <span className="break-all">
            {p.email} · Kunde seit {formatDate(p.createdAt)} ·{" "}
            {p.customerType === "b2b" ? "B2B" : "B2C"}
            {p.companyName ? ` · ${p.companyName}` : ""}
          </span>
        }
        meta={
          <span className="flex flex-wrap gap-1.5">
            <AccountBadge status={p.account.status} />
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!anonymized ? (
              <>
                <ButtonLink href={`${path}?tab=notizen#notiz`}>Notiz</ButtonLink>
                <a href={`mailto:${p.email}`} className={buttonClasses("secondary", "md")}>
                  E-Mail senden
                </a>
              </>
            ) : null}
            <a
              href={`${path}/auskunft`}
              download
              className={buttonClasses("secondary", "md")}
              title="Datenauskunft nach Art. 15 DSGVO als JSON"
            >
              <Icon name="download" size={16} />
              Datenauskunft
            </a>
            <CustomerActions
              target={{
                id: p.id,
                name: p.name,
                email: p.email,
                blocked,
                anonymized,
                activatable: !p.account.authUserId && !blocked,
                canManage,
                erasureRules: ERASURE_RULES.map((r) => ({
                  label: r.label,
                  action: r.action,
                  detail: r.detail,
                })),
              }}
            />
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {anonymized ? (
          <Notice tone="warning">
            Dieser Kunde wurde am {formatDateTime(p.account.anonymizedAt)} gelöscht und
            pseudonymisiert. Bestellungen bleiben wegen der Aufbewahrungspflicht erhalten.
          </Notice>
        ) : null}
        {blocked ? (
          <Notice tone="warning">
            Gesperrt seit {formatDateTime(p.account.blockedAt)}
            {p.account.blockedReason ? `: ${p.account.blockedReason}` : ""}. Anmeldung und Konto
            sind blockiert.
          </Notice>
        ) : null}

        {!anonymized && tab === "uebersicht" ? (
          <TagEditor customerId={p.id} tags={p.tags} suggestions={tagSuggestions} compact />
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Umsatz gesamt"
            value={formatMoney(p.kpis.totalSpentCents)}
            hint="inkl. MwSt."
          />
          <KpiCard
            label="Ø Bestellwert"
            value={formatMoney(p.kpis.averageOrderCents)}
            hint={`${p.kpis.ordersCount} ${p.kpis.ordersCount === 1 ? "Bestellung" : "Bestellungen"}`}
          />
          <KpiCard
            label="Bestellungen"
            value={p.kpis.ordersCount}
            hint={`davon ${p.kpis.cancelledCount} storniert`}
          />
          <KpiCard
            label="Erste Bestellung"
            value={formatDate(p.kpis.firstOrder?.at)}
            hint={p.kpis.firstOrder?.orderNumber ?? " "}
          />
          <KpiCard
            label="Letzte Bestellung"
            value={formatDate(p.kpis.lastOrder?.at)}
            hint={p.kpis.lastOrder?.orderNumber ?? " "}
          />
          <KpiCard
            label="Akquisequelle"
            value={p.acquisition.source ?? "unbekannt"}
            hint={acquisitionHint(p.acquisition.details)}
          />
        </div>

        <Tabs items={tabItems} label="Bereiche des Kundenprofils" />

        {tab === "uebersicht" ? (
          <Overview p={p} subscriptions={subscriptions} path={path} session={session} />
        ) : null}
        {tab === "bestellungen" ? <OrdersCard orders={p.orders} full /> : null}
        {tab === "newsletter" ? <NewsletterProof p={p} path={path} full /> : null}
        {tab === "notizen" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Tags" description="Für Filter, Segmente und die Übersicht im Team">
              {anonymized ? (
                <p className="text-admin-text-2 text-[13px]">Gelöschte Kunden haben keine Tags.</p>
              ) : (
                <TagEditor customerId={p.id} tags={p.tags} suggestions={tagSuggestions} />
              )}
            </Card>
            <Card title="Notizen" description="Nur intern sichtbar" id="notiz">
              <div className="flex flex-col gap-4">
                {!anonymized ? <NoteForm customerId={p.id} rows={3} /> : null}
                <NoteList
                  customerId={p.id}
                  notes={p.notes}
                  currentUserId={session.userId}
                  canDeleteAll={canManage}
                />
              </div>
            </Card>
          </div>
        ) : null}
        {tab === "aktivitaet" ? (
          <Card
            title="Timeline"
            description="Bestellungen, E-Mails, Newsletter, Notizen und Kontoereignisse"
          >
            <TimelineList entries={p.timeline} />
          </Card>
        ) : null}
      </div>
    </>
  );
}

function acquisitionHint(details: unknown): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) return " ";
  const d = details as Record<string, unknown>;
  const parts = ["utm_source", "utm_medium", "utm_campaign"]
    .filter((k) => typeof d[k] === "string" && d[k])
    .map((k) => `${k}=${String(d[k])}`);
  return parts.join(" · ") || " ";
}

function Overview({
  p,
  subscriptions,
  path,
  session,
}: {
  p: CustomerProfile;
  subscriptions: CustomerSubscriptionRow[];
  path: string;
  session: { userId: string; role: string };
}) {
  const anonymized = p.account.status === "anonymized";
  const defaultShipping = p.addresses.find((a) => a.isDefaultShipping) ?? p.addresses[0];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <OrdersCard orders={p.orders.slice(0, 5)} total={p.orders.length} path={path} />
        <Card title="Aktivität">
          <div className="flex flex-col gap-4">
            {!anonymized ? <NoteForm customerId={p.id} rows={1} /> : null}
            <TimelineList entries={p.timeline.slice(0, 8)} />
            {p.timeline.length > 8 ? (
              <Link
                href={`${path}?tab=aktivitaet`}
                className={`${cardActionClass} inline-flex items-center gap-1`}
              >
                Ganze Timeline ({p.timeline.length})
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Kontakt">
          <InfoList
            rows={[
              { label: "E-Mail", value: <span className="break-all">{p.email}</span> },
              { label: "Telefon", value: p.phone ?? "nicht hinterlegt" },
              { label: "Sprache", value: p.locale === "de" ? "Deutsch" : p.locale },
              {
                label: "Kundenkonto",
                value: ACCOUNT_STATUS_LABEL[p.account.status],
              },
              ...(p.account.activationEmailSentAt
                ? [
                    {
                      label: "Aktivierungslink",
                      value: formatDateTime(p.account.activationEmailSentAt),
                    },
                  ]
                : []),
              ...(p.vatId ? [{ label: "USt-IdNr.", value: p.vatId }] : []),
              ...(p.account.shopifyCustomerId
                ? [{ label: "Shopify-ID", value: String(p.account.shopifyCustomerId) }]
                : []),
            ]}
          />
        </Card>
        {subscriptions.length > 0 ? (
          <Card title="Abo" description="Nur lesend, Verwaltung im Abo-Modul">
            <ul className="divide-admin-rahmen flex flex-col divide-y">
              {subscriptions.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">
                      {s.quantity} × {s.productTitle ?? "Produkt"}
                      {s.variantTitle ? ` (${s.variantTitle})` : ""}
                    </span>
                    <Badge
                      tone={
                        s.status === "active"
                          ? "green"
                          : s.status === "cancelled"
                            ? "gray"
                            : "yellow"
                      }
                    >
                      {SUBSCRIPTION_STATUS[s.status] ?? s.status}
                    </Badge>
                  </span>
                  <span className="text-admin-text-2 text-[13px]">
                    alle {s.intervalCount} {intervalLabel(s.intervalUnit, s.intervalCount)}
                    {s.discountBp
                      ? ` · ${(s.discountBp / 100).toLocaleString("de-DE")} % Rabatt`
                      : ""}
                    {s.nextOrderAt && s.status === "active"
                      ? ` · nächste Lieferung ${formatDate(s.nextOrderAt)}`
                      : ""}
                    {s.pausedUntil ? ` · pausiert bis ${formatDate(s.pausedUntil)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <Card title="Adressen">
          {defaultShipping ? (
            <div className="flex flex-col gap-3 text-[14px]">
              {p.addresses.map((a) => (
                <address key={a.id} className="not-italic">
                  <p className="text-admin-text-2 mb-1 text-[12px] font-semibold tracking-wide uppercase">
                    {a.label ?? "Adresse"}
                    {a.isDefaultShipping ? " · Lieferadresse (Standard)" : ""}
                    {a.isDefaultBilling ? " · Rechnungsadresse" : ""}
                  </p>
                  <p>
                    {a.firstName} {a.lastName}
                  </p>
                  {a.company ? <p>{a.company}</p> : null}
                  <p>
                    {a.street} {a.houseNumber}
                  </p>
                  {a.addressAddition ? <p>{a.addressAddition}</p> : null}
                  <p>
                    {a.postalCode} {a.city}
                  </p>
                  <p>{a.countryCode === "DE" ? "Deutschland" : a.countryCode}</p>
                </address>
              ))}
            </div>
          ) : (
            <p className="text-admin-text-2 text-[13px]">Keine gespeicherten Adressen.</p>
          )}
        </Card>
        <NewsletterProof p={p} path={path} />
        <Card
          title="Notizen"
          action={<span className="text-admin-text-2 text-[13px]">{p.notes.length}</span>}
        >
          <NoteList
            customerId={p.id}
            notes={p.notes}
            currentUserId={session.userId}
            canDeleteAll={session.role === "owner" || session.role === "admin"}
            limit={3}
          />
        </Card>
      </div>
    </div>
  );
}

function intervalLabel(unit: string, count: number): string {
  const one = count === 1;
  if (unit === "week") return one ? "Woche" : "Wochen";
  if (unit === "month") return one ? "Monat" : "Monate";
  if (unit === "day") return one ? "Tag" : "Tage";
  return unit;
}

function OrderBadges({ o }: { o: CustomerOrderRow }) {
  const b = deriveOrderBadges({
    status: o.status as OrderStatus,
    paymentStatus: o.paymentStatus as PaymentStatus,
    isTest: o.isTest,
  });
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={b.fulfilment.tone} hollow={b.fulfilment.hollow}>
        {b.fulfilment.label}
      </Badge>
      <Badge tone={b.payment.tone} hollow={b.payment.hollow}>
        {b.payment.label}
      </Badge>
      {b.test ? <Badge tone="gray">Test</Badge> : null}
    </span>
  );
}

function OrdersCard({
  orders,
  total,
  path,
  full,
}: {
  orders: CustomerOrderRow[];
  total?: number;
  path?: string;
  full?: boolean;
}) {
  return (
    <section aria-labelledby="bestellhistorie" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="bestellhistorie" className="text-[16px] font-semibold">
          Bestellhistorie
        </h2>
        {!full && path && (total ?? 0) > 0 ? (
          <Link
            href={`${path}?tab=bestellungen`}
            className={`${cardActionClass} inline-flex items-center gap-1`}
          >
            Alle Bestellungen ({total})
          </Link>
        ) : null}
      </div>
      <Table
        caption="Bestellungen des Kunden"
        rows={orders}
        rowKey={(o) => o.id}
        rowHref={(o) => `/admin/bestellungen/${o.id}`}
        empty={<EmptyState icon="bestellungen" title="Noch keine Bestellungen" compact />}
        columns={[
          {
            key: "nummer",
            header: "Bestellung",
            cell: (o) => <span className="text-admin-akzent">{o.orderNumber}</span>,
          },
          { key: "datum", header: "Datum", width: "120px", cell: (o) => formatDate(o.placedAt) },
          { key: "status", header: "Status", cell: (o) => <OrderBadges o={o} /> },
          {
            key: "artikel",
            header: "Artikel",
            width: "90px",
            hideBelowLg: true,
            cell: (o) => `${o.itemCount} Artikel`,
          },
          {
            key: "summe",
            header: "Summe",
            align: "right",
            width: "110px",
            cell: (o) => (
              <span className="font-semibold tabular-nums">{formatMoney(o.totalCents)}</span>
            ),
          },
        ]}
        renderCard={(o) => (
          <CardRow
            primary={<span className="text-admin-akzent">{o.orderNumber}</span>}
            aside={formatMoney(o.totalCents)}
            secondary={`${formatDate(o.placedAt)} · ${o.itemCount} Artikel`}
            badges={<OrderBadges o={o} />}
          />
        )}
      />
    </section>
  );
}

function NewsletterProof({ p, path, full }: { p: CustomerProfile; path: string; full?: boolean }) {
  const n = p.newsletter;
  const rows = [
    { label: "Opt-in angefordert", value: formatDateTime(n.requestedAt) },
    {
      label:
        n.kind === "shopify_import" ? "Bestätigt (Shopify-Import)" : "Bestätigt (Double Opt-in)",
      value: formatDateTime(n.confirmedAt),
    },
    { label: "IP-Adresse beim Bestätigen", value: n.ip ?? "–" },
    { label: "Quelle", value: n.sourceLabel ?? "–" },
    {
      label: "Einwilligungstext",
      value: n.consentVersion ? `Version ${n.consentVersion}` : "–",
    },
    ...(full
      ? [
          { label: "Browser beim Bestätigen", value: n.userAgent ?? "–" },
          { label: "Import-Zeitstempel", value: formatDateTime(n.importedConsentAt) },
        ]
      : []),
    ...(n.unsubscribedAt
      ? [
          { label: "Abgemeldet", value: formatDateTime(n.unsubscribedAt) },
          { label: "Grund der Abmeldung", value: n.unsubscribeReason ?? "–" },
        ]
      : []),
  ];
  return (
    <Card
      title={full ? "Newsletter-Nachweis" : "Newsletter"}
      description={full ? "Nachweis der Einwilligung nach Art. 7 Abs. 1 DSGVO" : undefined}
      action={<NewsletterBadge status={n.status} />}
    >
      <div className="flex flex-col gap-3">
        <InfoList rows={rows} />
        <p className="text-admin-text-2 text-[13px]">{n.note}</p>
        {full && n.consentText ? (
          <details className="rounded-admin-feld border-admin-rahmen border text-[13px]" open>
            <summary className="cursor-pointer px-3 py-2.5 font-medium">
              Wortlaut der Einwilligung
            </summary>
            <p className="border-admin-rahmen border-t px-3 py-2.5 whitespace-pre-line">
              {n.consentText}
            </p>
          </details>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          {!full && n.status !== "none" ? (
            <Link
              href={`${path}?tab=newsletter`}
              className={`${cardActionClass} inline-flex items-center gap-1`}
            >
              <Icon name="auge" size={16} />
              Nachweis ansehen
            </Link>
          ) : null}
          {p.newsletterContactId && (n.status === "subscribed" || n.status === "pending") ? (
            <UnsubscribeDialog
              contactId={p.newsletterContactId}
              email={p.email}
              returnPath={path}
              small
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function TimelineList({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0)
    return <p className="text-admin-text-2 text-[13px]">Noch keine Aktivität.</p>;
  const items: TimelineItem[] = entries.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.orderId ? (
      <>
        {e.detail ? <span className="block break-words">{e.detail}</span> : null}
        <Link
          href={`/admin/bestellungen/${e.orderId}`}
          className="text-admin-akzent hover:underline"
        >
          Zur Bestellung
        </Link>
      </>
    ) : (
      (e.detail ?? undefined)
    ),
    at: e.at,
    icon: SOURCE_ICON[e.source],
    tone:
      e.source === "order"
        ? "accent"
        : e.kind === "blocked" || e.kind.includes("unsub") || e.kind.includes("bounce")
          ? "red"
          : e.source === "newsletter" && e.kind === "newsletter_confirmed"
            ? "green"
            : "default",
  }));
  return <Timeline items={items} />;
}
