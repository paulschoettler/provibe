import Link from "next/link";
import type {
  CancellationRequestDetail as Detail,
  CancellationRequestRow,
} from "@/lib/subscriptions/admin-queries";
import { resolveCancellationRequestAction } from "@/lib/subscriptions/admin-actions";
import { formatDay } from "@/lib/subscriptions/schedule";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { Textarea } from "@/components/admin/ui/fields";
import { formatDateTime } from "@/components/admin/ui/format";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { REQUEST_STATUS, STATUS_BADGE } from "./labels";

/** "ordentlich, nächstmöglich", "ordentlich zum 14.11.2026", "außerordentlich, sofort" */
export function requestTimingText(
  r: Pick<CancellationRequestRow, "kind" | "timing" | "desiredDate">,
) {
  if (r.kind === "extraordinary") return "außerordentlich, sofort";
  return r.timing === "date" && r.desiredDate
    ? `ordentlich zum ${formatDay(r.desiredDate)}`
    : "ordentlich, nächstmöglich";
}

function SubscriptionLinks({ items }: { items: Detail["subscriptions"] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((sub) => (
        <li key={sub.id} className="flex items-center gap-2 text-[14px]">
          <Link
            href={`/admin/abos/${sub.id}`}
            className="text-admin-akzent font-bold underline underline-offset-2"
          >
            {sub.number}
          </Link>
          <Badge tone={STATUS_BADGE[sub.status].tone}>{STATUS_BADGE[sub.status].label}</Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * Detail einer Kündigungserklärung ohne Login: Angaben aus dem Formular, gekündigte Abos, Abos mit
 * derselben E-Mail-Adresse als Hilfe beim Zuordnen und die Klärung mit Notiz (resolveCancellationRequest).
 */
export function CancellationRequestDetail({ entry }: { entry: Detail }) {
  const s = REQUEST_STATUS[entry.status];
  const open = entry.status === "unmatched" || entry.status === "received";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Angaben" className="lg:col-span-2">
        <dl className="grid grid-cols-[minmax(0,130px)_1fr] gap-x-3 gap-y-2 text-[14px]">
          <dt className="text-admin-text-2">Status</dt>
          <dd>
            <Badge tone={s.tone} hollow={s.hollow}>
              {s.label}
            </Badge>
          </dd>
          <dt className="text-admin-text-2">Eingang</dt>
          <dd>{formatDateTime(entry.receivedAt)}</dd>
          <dt className="text-admin-text-2">Name</dt>
          <dd className="break-words">{entry.name}</dd>
          <dt className="text-admin-text-2">E-Mail</dt>
          <dd className="break-all">{entry.email}</dd>
          <dt className="text-admin-text-2">Abo-Nummer</dt>
          <dd>{entry.subscriptionNumber ?? "nicht angegeben (gilt für alle offenen Abos, H28)"}</dd>
          <dt className="text-admin-text-2">Art</dt>
          <dd>{requestTimingText(entry)}</dd>
          {entry.reason ? (
            <>
              <dt className="text-admin-text-2">Grund</dt>
              <dd className="break-words">{entry.reason}</dd>
            </>
          ) : null}
          <dt className="text-admin-text-2">Bestätigung</dt>
          <dd>
            {entry.confirmationSentAt
              ? `per E-Mail am ${formatDateTime(entry.confirmationSentAt)}`
              : "noch nicht verschickt"}
          </dd>
        </dl>
        {entry.status === "unmatched" ? (
          <p className="text-admin-text-2 mt-4 text-[13px]">
            Die Person hat dieselbe Bestätigungsseite gesehen wie bei einem passenden Abo (H28).
            Prüfe, ob es ein Abo unter einer anderen Adresse gibt, und melde dich bei Bedarf direkt.
          </p>
        ) : null}
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Gekündigte Abos">
          {entry.subscriptions.length ? (
            <SubscriptionLinks items={entry.subscriptions} />
          ) : (
            <p className="text-admin-text-2 text-[14px]">Keinem Abo zugeordnet.</p>
          )}
        </Card>
        {entry.candidates.length ? (
          <Card
            title="Abos mit derselben E-Mail-Adresse"
            description="Passt eines, kündige es dort im Auftrag des Kunden und markiere den Fall hier als geklärt."
          >
            <SubscriptionLinks items={entry.candidates} />
          </Card>
        ) : null}
        <Card title="Klärung">
          {entry.note ? (
            <div className="mb-3">
              <p className="text-[14px] whitespace-pre-wrap">{entry.note}</p>
              <p className="text-admin-text-2 mt-1 text-[12px]">
                Stand {formatDateTime(entry.updatedAt)}
              </p>
            </div>
          ) : null}
          {open ? (
            <ActionForm
              action={resolveCancellationRequestAction}
              hideMessage
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="id" value={entry.id} />
              <ActionFormMessage />
              <Textarea
                name="note"
                label="Notiz zur Klärung"
                rows={3}
                required
                placeholder="Zum Beispiel: Abo gehört zur Zweitadresse, dort gekündigt und Kundin informiert."
              />
              <SubmitButton pendingLabel="Wird gespeichert …">Als geklärt markieren</SubmitButton>
            </ActionForm>
          ) : entry.note ? null : (
            <p className="text-admin-text-2 text-[14px]">Keine Klärung nötig.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
