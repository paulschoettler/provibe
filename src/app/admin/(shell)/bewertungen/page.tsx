import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/admin/auth";
import {
  approveReviewsAction,
  deleteReviewAction,
  rejectReviewAction,
  replyReviewAction,
} from "@/lib/admin/reviews/actions";
import {
  canDeleteReviews,
  canModerateReviews,
  getReview,
  listReviews,
  reviewCounts,
  reviewedProducts,
  type ReviewListItem,
} from "@/lib/admin/reviews/queries";
import {
  excerpt,
  REJECTION_REASONS,
  rejectionLabel,
  REVIEW_STATUS_LABELS,
  REVIEW_TABS,
  stars,
  statusFromTab,
} from "@/lib/admin/reviews/rules";
import { NoAccess } from "@/components/admin/NoAccess";
import { Hint } from "@/components/admin/content/parts";
import { InlineAction } from "@/components/admin/content/InlineAction";
import { ActionForm, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Drawer } from "@/components/admin/ui/Drawer";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { Field, Select, Textarea } from "@/components/admin/ui/fields";
import { formatDate, formatDateTime } from "@/components/admin/ui/format";
import { firstParam, withParams, type SearchParamsInput } from "@/components/admin/ui/href";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { Pagination, parsePage } from "@/components/admin/ui/Pagination";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { CardRow, Table } from "@/components/admin/ui/Table";
import { Tabs } from "@/components/admin/ui/Tabs";

export const metadata: Metadata = { title: "Bewertungen" };

const PATH = "/admin/bewertungen";
const BULK_FORM = "bewertungen-freigeben";

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="text-admin-akzent text-[15px] tracking-[1px] whitespace-nowrap"
      aria-label={`${rating} von 5 Sternen`}
    >
      <span aria-hidden="true">{stars(rating)}</span>
    </span>
  );
}

function Author({ r }: { r: ReviewListItem }) {
  return (
    <span className="min-w-0">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="truncate font-medium">{r.authorName}</span>
        {r.isVerifiedPurchase ? (
          <Badge tone="green" noDot>
            Kauf verifiziert
          </Badge>
        ) : (
          <Badge tone="yellow" hollow>
            nicht verifiziert
          </Badge>
        )}
      </span>
      {r.customer ? (
        <span className="text-admin-text-2 block truncate text-[12px]">{r.customer.email}</span>
      ) : null}
    </span>
  );
}

/**
 * /admin/bewertungen: Moderation der Produktbewertungen (public.reviews). Tabs Offen,
 * Freigegeben, Abgelehnt, bewusst ohne Sternefilter (UWG). Detail im Drawer ?eintrag=:
 * Freigeben, Ablehnen mit Pflichtgrund, Antwort des Shops, Löschen auf Kundenwunsch.
 */
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const session = await requireStaff("support", { next: PATH });
  if (!canModerateReviews(session)) return <NoAccess />;
  const canDelete = canDeleteReviews(session);
  const sp = await searchParams;
  const tab = firstParam(sp.tab) ?? "offen";
  const status = statusFromTab(tab);
  const q = firstParam(sp.q);
  const produkt = firstParam(sp.produkt);
  const page = parsePage(firstParam(sp.seite));
  const eintrag = firstParam(sp.eintrag);

  let failed = false;
  let list: Awaited<ReturnType<typeof listReviews>> = { rows: [], total: 0, pageSize: 50 };
  let counts = { pending: 0, approved: 0, rejected: 0 };
  let products: { id: string; title: string }[] = [];
  try {
    [list, counts, products] = await Promise.all([
      listReviews({
        status,
        q,
        productId: produkt && /^[0-9a-f-]{36}$/i.test(produkt) ? produkt : undefined,
        page,
      }),
      reviewCounts(),
      reviewedProducts(),
    ]);
  } catch {
    failed = true;
  }
  const detail = eintrag ? await getReview(eintrag) : null;
  const closeHref = withParams(PATH, sp, { eintrag: null });
  const pendingTab = status === "pending";

  return (
    <>
      <PageHeader
        title="Bewertungen"
        description="Nur Kundinnen und Kunden mit Bestellung können bewerten (Link aus der Bewertungsanfrage)."
      />
      <Hint className="mb-4">
        UWG: Freigeben nie nach Sternen auswählen. Negative Bewertungen nur ablehnen, wenn sie gegen
        die Bewertungsregeln verstoßen (Beleidigung, fremde Daten, Werbung, kein Produktbezug,
        Zweifel an der Echtheit). Der Grund ist Pflicht und wird protokolliert. Geänderte
        Bewertungen stehen wieder auf Offen.
      </Hint>
      {failed ? (
        <FormMessage tone="error">Die Bewertungen konnten gerade nicht geladen werden.</FormMessage>
      ) : null}
      <Tabs
        label="Status"
        className="mb-4"
        items={REVIEW_TABS.map((t) => ({
          label: t.label,
          href: withParams(PATH, sp, { tab: t.key, seite: null, eintrag: null }),
          active: t.status === status,
          count: counts[t.status],
        }))}
      />
      <Table
        caption={`Bewertungen: ${REVIEW_STATUS_LABELS[status]}`}
        rows={list.rows}
        rowKey={(r) => r.id}
        rowHref={(r) => withParams(PATH, sp, { eintrag: r.id })}
        selection={
          pendingTab
            ? {
                formId: BULK_FORM,
                value: (r) => r.id,
                label: (r) => `Bewertung von ${r.authorName}`,
              }
            : undefined
        }
        toolbar={
          <>
            <FilterBar
              action={PATH}
              search={{ value: q, placeholder: "Name oder Text", label: "Bewertungen suchen" }}
              hidden={{ tab }}
              resetHref={withParams(PATH, {}, { tab })}
            >
              <Select
                name="produkt"
                label="Produkt"
                hideLabel
                placeholder="Alle Produkte"
                defaultValue={produkt ?? ""}
                options={products.map((p) => ({ value: p.id, label: p.title }))}
              />
            </FilterBar>
            {pendingTab && list.rows.length ? (
              <ActionForm
                id={BULK_FORM}
                action={approveReviewsAction}
                className="flex flex-wrap items-center gap-2 px-3 pb-3"
              >
                <SubmitButton variant="secondary" size="sm" icon="haken">
                  Auswahl freigeben
                </SubmitButton>
                <span className="text-admin-text-2 text-[12px]">
                  Gesammelt freigeben, nicht nach Sternen auswählen.
                </span>
              </ActionForm>
            ) : null}
          </>
        }
        columns={[
          {
            key: "sterne",
            header: "Sterne",
            width: "110px",
            cell: (r) => <Stars rating={r.rating} />,
          },
          {
            key: "produkt",
            header: "Produkt",
            width: "160px",
            hideBelowLg: true,
            cell: (r) => <span className="truncate">{r.product?.title ?? "–"}</span>,
          },
          {
            key: "auszug",
            header: "Auszug",
            cell: (r) => (
              <span className="min-w-0">
                {r.title ? <span className="block truncate font-medium">{r.title}</span> : null}
                <span className="text-admin-text-2 block truncate text-[13px]">
                  {excerpt(r.body, 90) || "ohne Text"}
                </span>
                {r.changedAfterModeration ? (
                  <Badge tone="blue" hollow>
                    geändert, neu prüfen
                  </Badge>
                ) : null}
              </span>
            ),
          },
          { key: "kunde", header: "Kunde", width: "220px", cell: (r) => <Author r={r} /> },
          { key: "datum", header: "Datum", width: "100px", cell: (r) => formatDate(r.createdAt) },
        ]}
        rowActions={
          pendingTab
            ? (r) => (
                <InlineAction
                  action={approveReviewsAction}
                  fields={{ ids: r.id }}
                  label="Freigeben"
                  srLabel={`Bewertung von ${r.authorName} freigeben`}
                />
              )
            : undefined
        }
        renderCard={(r) => (
          <CardRow
            primary={<Stars rating={r.rating} />}
            aside={formatDate(r.createdAt)}
            secondary={
              <span className="block">
                <span className="text-admin-text block font-medium">
                  {r.title ?? r.product?.title}
                </span>
                {excerpt(r.body, 110)}
              </span>
            }
            badges={
              <>
                <Badge tone="gray" noDot>
                  {r.product?.title ?? "Produkt"}
                </Badge>
                <Badge tone={r.isVerifiedPurchase ? "green" : "yellow"} noDot>
                  {r.isVerifiedPurchase ? "Kauf verifiziert" : "nicht verifiziert"}
                </Badge>
              </>
            }
          />
        )}
        empty={
          <EmptyState
            icon="notiz"
            title={pendingTab ? "Keine offenen Bewertungen" : "Keine Bewertungen"}
          >
            {pendingTab
              ? "Neue Bewertungen erscheinen hier, sobald jemand über den Link aus der Bewertungsanfrage bewertet."
              : "Hier ist noch nichts."}
          </EmptyState>
        }
        footer={
          list.total > list.pageSize ? (
            <Pagination
              page={page}
              pageSize={list.pageSize}
              total={list.total}
              hrefFor={(p) => withParams(PATH, sp, { seite: p })}
            />
          ) : null
        }
      />

      <Drawer open={Boolean(detail)} closeHref={closeHref} title="Bewertung prüfen" width="md">
        {detail ? (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <Stars rating={detail.rating} />
                <Badge
                  tone={
                    detail.status === "approved"
                      ? "green"
                      : detail.status === "rejected"
                        ? "red"
                        : "yellow"
                  }
                  hollow={detail.status === "pending"}
                >
                  {REVIEW_STATUS_LABELS[detail.status]}
                </Badge>
              </div>
              {detail.title ? <h3 className="text-[16px] font-semibold">{detail.title}</h3> : null}
              <p className="text-[14px] leading-[1.6] whitespace-pre-line">
                {detail.body ?? "ohne Text"}
              </p>
            </div>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-admin-text-2">Produkt</dt>
              <dd>
                {detail.product ? (
                  <Link
                    href={`/products/${detail.product.handle}`}
                    target="_blank"
                    className="text-admin-akzent underline-offset-2 hover:underline"
                  >
                    {detail.product.title}
                  </Link>
                ) : (
                  "–"
                )}
              </dd>
              <dt className="text-admin-text-2">Kunde</dt>
              <dd>
                {detail.authorName}
                {detail.customer ? (
                  <>
                    {" · "}
                    <Link
                      href={`/admin/kunden/${detail.customer.id}`}
                      className="text-admin-akzent underline-offset-2 hover:underline"
                    >
                      {detail.customer.email}
                    </Link>
                  </>
                ) : null}
              </dd>
              <dt className="text-admin-text-2">Kauf</dt>
              <dd>
                {detail.isVerifiedPurchase ? "verifiziert" : "nicht verifiziert"}
                {detail.order ? (
                  <>
                    {" · "}
                    <Link
                      href={`/admin/bestellungen/${detail.order.id}`}
                      className="text-admin-akzent underline-offset-2 hover:underline"
                    >
                      {detail.order.number}
                    </Link>
                  </>
                ) : null}
              </dd>
              <dt className="text-admin-text-2">Eingang</dt>
              <dd>{formatDateTime(detail.createdAt)}</dd>
              {detail.moderatedAt ? (
                <>
                  <dt className="text-admin-text-2">Moderiert</dt>
                  <dd>{formatDateTime(detail.moderatedAt)}</dd>
                </>
              ) : null}
              {detail.rejectionReason ? (
                <>
                  <dt className="text-admin-text-2">Grund</dt>
                  <dd>{rejectionLabel(detail.rejectionReason)}</dd>
                </>
              ) : null}
            </dl>
            {detail.changedAfterModeration ? (
              <Hint tone="info">
                Die Kundin hat die Bewertung nach der letzten Moderation geändert. Bitte neu prüfen.
              </Hint>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {detail.status !== "approved" ? (
                <InlineAction
                  action={approveReviewsAction}
                  fields={{ ids: detail.id }}
                  label="Freigeben"
                  variant="primary"
                  size="md"
                />
              ) : null}
              {detail.status !== "rejected" ? (
                <InlineAction
                  action={rejectReviewAction}
                  fields={{ id: detail.id }}
                  label="Ablehnen"
                  size="md"
                  confirm={{
                    title: "Bewertung ablehnen",
                    description:
                      "Nur bei einem Verstoß gegen die Bewertungsregeln, nie wegen der Sterne. Der Grund wird protokolliert.",
                    confirmLabel: "Ablehnen",
                    danger: true,
                  }}
                >
                  <Select
                    name="reason"
                    label="Regelverstoß"
                    placeholder="Bitte wählen"
                    options={REJECTION_REASONS.map((r) => ({ value: r.value, label: r.label }))}
                    required
                  />
                  <Textarea
                    name="detail"
                    label="Details"
                    rows={3}
                    maxLength={500}
                    hint="Bei „Sonstiger Verstoß“ Pflicht. Bleibt intern."
                  />
                </InlineAction>
              ) : null}
            </div>

            <ActionForm
              action={replyReviewAction}
              resetOnSuccess={false}
              className="border-admin-rahmen flex flex-col gap-3 border-t pt-4"
            >
              <input type="hidden" name="id" value={detail.id} />
              <Textarea
                name="replyBody"
                label="Antwort des Shops"
                defaultValue={detail.replyBody ?? ""}
                rows={4}
                maxLength={2000}
                hint={
                  detail.replyAt
                    ? `Zuletzt beantwortet ${formatDateTime(detail.replyAt)}. Leer speichern entfernt die Antwort.`
                    : "Erscheint unter der Bewertung, sobald sie freigegeben ist. Freundlich, ohne Kundendaten."
                }
              />
              <div className="flex justify-end">
                <SubmitButton variant="secondary">Antwort speichern</SubmitButton>
              </div>
            </ActionForm>

            {canDelete ? (
              <div className="border-admin-rahmen border-t pt-4">
                <InlineAction
                  action={deleteReviewAction}
                  fields={{ id: detail.id, tab }}
                  label="Löschen auf Kundenwunsch"
                  variant="text"
                  confirm={{
                    title: "Bewertung endgültig löschen?",
                    description:
                      "Nur auf Wunsch der Kundin oder des Kunden (DSGVO). Im Protokoll bleibt nur der Anlass, nicht der Text.",
                    confirmLabel: "Endgültig löschen",
                    danger: true,
                  }}
                >
                  <Field name="note" label="Anlass" placeholder="Mail vom 17.10.2026" required />
                </InlineAction>
              </div>
            ) : null}
            <ButtonLink href={closeHref} variant="secondary">
              Schließen
            </ButtonLink>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
