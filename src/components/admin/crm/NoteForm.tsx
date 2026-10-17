import { addNoteAction, deleteNoteAction } from "@/lib/admin/customers/ui-actions";
import { ActionForm } from "@/components/admin/ui/ActionForm";
import { Textarea } from "@/components/admin/ui/fields";
import { formatDateTime } from "@/components/admin/ui/format";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import type { CustomerNoteRow } from "@/lib/admin/customers/queries";

/** Interne Notiz anlegen (Figma "Notiz hinzufügen, nur intern sichtbar"). */
export function NoteForm({ customerId, rows = 2 }: { customerId: string; rows?: number }) {
  return (
    <ActionForm action={addNoteAction} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <input type="hidden" name="customerId" value={customerId} />
      <Textarea
        name="body"
        label="Notiz"
        hideLabel
        placeholder="Notiz hinzufügen, nur intern sichtbar"
        rows={rows}
        maxLength={5000}
        className="flex-1"
      />
      <SubmitButton variant="secondary" pendingLabel="Wird gespeichert …">
        Speichern
      </SubmitButton>
    </ActionForm>
  );
}

/** Liste der Notizen; löschen darf die Person, die sie geschrieben hat, sowie Owner und Admin. */
export function NoteList({
  customerId,
  notes,
  currentUserId,
  canDeleteAll,
  limit,
}: {
  customerId: string;
  notes: CustomerNoteRow[];
  currentUserId: string;
  canDeleteAll: boolean;
  limit?: number;
}) {
  const shown = limit ? notes.slice(0, limit) : notes;
  if (shown.length === 0)
    return <p className="text-admin-text-2 text-[13px]">Noch keine Notizen.</p>;
  return (
    <ul className="divide-admin-rahmen flex flex-col divide-y">
      {shown.map((n) => (
        <li key={n.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] break-words whitespace-pre-line">{n.body}</p>
            <p className="text-admin-text-2 mt-1 text-[12px]">
              {n.authorName ?? "PROVIBE Team"} · {formatDateTime(n.createdAt)}
            </p>
          </div>
          {canDeleteAll || n.authorUserId === currentUserId ? (
            <ActionForm action={deleteNoteAction}>
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="noteId" value={n.id} />
              <SubmitButton variant="text" size="sm" pendingLabel="…">
                Löschen
              </SubmitButton>
            </ActionForm>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
