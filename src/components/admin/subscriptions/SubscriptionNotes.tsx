import { addSubscriptionNoteAction, listSubscriptionNotes } from "@/lib/subscriptions/admin-notes";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { Textarea } from "@/components/admin/ui/fields";
import { formatDateTime } from "@/components/admin/ui/format";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/**
 * Karte "Interne Notizen" im Abo-Detail (Server Component): Formular für Support, Admin und Owner,
 * darunter alle Notizen mit Autor und Zeit, neueste zuerst. Funktioniert ohne JavaScript.
 * Die Seite rendert die Karte nur für Rollen mit Kundendaten (nicht Fulfillment).
 */
export async function SubscriptionNotes({
  subscriptionId,
  names,
}: {
  subscriptionId: string;
  /** user_id → Anzeigename des Teams (staffNames) */
  names: Map<string, string>;
}) {
  let notes: Awaited<ReturnType<typeof listSubscriptionNotes>> = [];
  let failed = false;
  try {
    notes = await listSubscriptionNotes(subscriptionId);
  } catch (error) {
    console.error("[admin] Abo-Notizen", error);
    failed = true;
  }

  return (
    <Card
      title="Interne Notizen"
      action={
        <Badge tone="gray" noDot>
          Nur intern
        </Badge>
      }
    >
      <ActionForm action={addSubscriptionNoteAction} className="flex flex-col gap-2">
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <Textarea
          name="body"
          label="Notiz"
          hideLabel
          placeholder="Notiz hinzufügen, zum Beispiel Absprachen mit dem Kunden"
          rows={3}
          maxLength={5000}
          required
        />
        <div className="flex justify-end">
          <SubmitButton variant="secondary" pendingLabel="Wird gespeichert …">
            Notiz speichern
          </SubmitButton>
        </div>
      </ActionForm>
      <div className="mt-4">
        {failed ? (
          <p className="text-admin-rot text-[13px]">
            Die Notizen konnten gerade nicht geladen werden.
          </p>
        ) : notes.length === 0 ? (
          <p className="text-admin-text-2 text-[13px]">Noch keine Notizen.</p>
        ) : (
          <ul className="divide-admin-rahmen flex flex-col divide-y" aria-label="Notizen">
            {notes.map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[14px] break-words whitespace-pre-line">{n.body}</p>
                <p className="text-admin-text-2 mt-1 text-[12px]">
                  {(n.authorId ? names.get(n.authorId) : null) ?? "PROVIBE Team"} ·{" "}
                  <time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
