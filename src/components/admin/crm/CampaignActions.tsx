import {
  cancelCampaignAction,
  deleteCampaignAction,
  duplicateCampaignAction,
  scheduleCampaignAction,
  sendNowAction,
  testSendAction,
  unscheduleCampaignAction,
} from "@/lib/admin/newsletter/ui-actions";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Card } from "@/components/admin/ui/Card";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Field } from "@/components/admin/ui/fields";
import { formatNumber } from "@/components/admin/ui/format";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/**
 * Testversand, Planung, Sofortversand (mit Bestätigung und Empfängerzahl), Kopieren, Löschen,
 * Planung aufheben, Abbrechen. Alles Formulare mit Server Actions (ohne JavaScript nutzbar,
 * Dialoge mit JavaScript).
 */

export function TestSendCard({
  campaignId,
  defaultTo,
  allowlistHint,
}: {
  campaignId: string;
  defaultTo: string;
  allowlistHint: string;
}) {
  return (
    <Card title="Testversand">
      <ActionForm action={testSendAction} resetOnSuccess={false} className="flex flex-col gap-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="flex items-end gap-2">
          <Field
            name="to"
            type="email"
            label="Testadresse"
            defaultValue={defaultTo}
            className="flex-1"
            required
          />
          <SubmitButton variant="secondary" pendingLabel="…">
            Senden
          </SubmitButton>
        </div>
        <p className="text-admin-text-2 text-[12px]">{allowlistHint}</p>
      </ActionForm>
    </Card>
  );
}

export function PlanCard({
  campaignId,
  recipients,
  recipientsText,
  allowlistActive,
  defaultDate,
}: {
  campaignId: string;
  recipients: number;
  recipientsText: string;
  allowlistActive: boolean;
  defaultDate: string;
}) {
  return (
    <Card title="Planung" description="Plant den gespeicherten Stand der Kampagne">
      <div className="flex flex-col gap-4">
        <ActionForm action={scheduleCampaignAction} className="flex flex-col gap-3">
          <input type="hidden" name="campaignId" value={campaignId} />
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Field name="date" type="date" label="Datum" defaultValue={defaultDate} required />
            <Field name="time" type="time" label="Uhrzeit" defaultValue="10:00" required />
          </div>
          <p className="text-admin-text-2 text-[12px]">Zeit in Europe/Berlin.</p>
          <SubmitButton variant="secondary" pendingLabel="Wird geplant …" block>
            Zeitpunkt planen
          </SubmitButton>
        </ActionForm>
        <Dialog
          title="Kampagne jetzt senden?"
          trigger={{ label: "Sofort senden", variant: "primary", icon: "newsletter", block: true }}
          size="sm"
        >
          <ActionForm action={sendNowAction} closeDialogOnSuccess hideMessage>
            <input type="hidden" name="campaignId" value={campaignId} />
            <DialogBody>
              <ActionFormMessage />
              <p className="text-[15px]">
                <strong>{formatNumber(recipients)}</strong>{" "}
                {recipients === 1 ? "Empfänger" : "Empfänger"} mit bestätigter Einwilligung.
              </p>
              <p className="text-admin-text-2 text-[13px]">{recipientsText}</p>
              {allowlistActive ? (
                <p className="rounded-admin-feld bg-admin-gelb-hell px-3 py-2 text-[13px]">
                  Bis zum Go-live gehen nur Mails an Adressen der Test-Allowlist raus, alle anderen
                  werden als „Blockiert (Allowlist)“ protokolliert.
                </p>
              ) : null}
              <p className="text-[13px]">
                Der Versand startet sofort über die Job-Queue und lässt sich danach nur noch
                abbrechen, nicht zurückholen.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose />
              <SubmitButton pendingLabel="Wird gestartet …" disabled={recipients === 0}>
                Jetzt an {formatNumber(recipients)} senden
              </SubmitButton>
            </DialogFooter>
          </ActionForm>
        </Dialog>
      </div>
    </Card>
  );
}

export function CampaignMoreActions({
  campaignId,
  status,
  canSend,
}: {
  campaignId: string;
  status: string;
  canSend: boolean;
}) {
  if (!canSend) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "scheduled" ? (
        <ActionForm action={unscheduleCampaignAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <SubmitButton variant="secondary" pendingLabel="…">
            Planung aufheben
          </SubmitButton>
        </ActionForm>
      ) : null}
      {status === "scheduled" || status === "sending" ? (
        <Dialog
          title="Versand abbrechen?"
          trigger={{ label: "Abbrechen", variant: "danger" }}
          size="sm"
        >
          <ActionForm action={cancelCampaignAction} closeDialogOnSuccess hideMessage>
            <input type="hidden" name="campaignId" value={campaignId} />
            <DialogBody>
              <ActionFormMessage />
              <p className="text-[14px]">
                Offene Empfänger bekommen die Kampagne nicht mehr. Bereits verschickte Mails bleiben
                verschickt.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose>Zurück</DialogClose>
              <SubmitButton variant="danger" pendingLabel="…">
                Versand abbrechen
              </SubmitButton>
            </DialogFooter>
          </ActionForm>
        </Dialog>
      ) : null}
      <ActionForm action={duplicateCampaignAction}>
        <input type="hidden" name="campaignId" value={campaignId} />
        <SubmitButton variant="secondary" icon="kopieren" pendingLabel="…">
          Kopieren
        </SubmitButton>
      </ActionForm>
      {status === "draft" || status === "cancelled" ? (
        <Dialog title="Entwurf löschen?" trigger={{ label: "Löschen", variant: "text" }} size="sm">
          <ActionForm action={deleteCampaignAction} hideMessage>
            <input type="hidden" name="campaignId" value={campaignId} />
            <DialogBody>
              <ActionFormMessage />
              <p className="text-[14px]">
                Der Entwurf wird endgültig gelöscht. Kampagnen mit Empfängern bleiben als Nachweis
                erhalten.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose />
              <SubmitButton variant="danger" pendingLabel="…">
                Löschen
              </SubmitButton>
            </DialogFooter>
          </ActionForm>
        </Dialog>
      ) : null}
    </div>
  );
}
