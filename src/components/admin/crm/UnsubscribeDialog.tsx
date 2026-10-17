"use client";

import { unsubscribeContactAction } from "@/lib/admin/newsletter/ui-actions";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Field } from "@/components/admin/ui/fields";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/** Newsletter-Kontakt von Hand abmelden, mit Grund (zum Beispiel "Wunsch per E-Mail"). */
export function UnsubscribeDialog({
  contactId,
  email,
  returnPath,
  triggerLabel = "Abmelden",
  small,
}: {
  contactId: string;
  email: string;
  returnPath: string;
  triggerLabel?: string;
  small?: boolean;
}) {
  return (
    <Dialog
      title="Newsletter abmelden?"
      description={email}
      size="sm"
      trigger={{ label: triggerLabel, variant: small ? "text" : "secondary", icon: "schliessen" }}
    >
      <ActionForm action={unsubscribeContactAction} closeDialogOnSuccess hideMessage>
        <input type="hidden" name="contactId" value={contactId} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <DialogBody>
          <ActionFormMessage />
          <p className="text-[14px]">
            Der Kontakt bekommt danach keine Werbemails mehr. Der Opt-in-Nachweis bleibt
            gespeichert, die Abmeldung steht mit Zeitpunkt und Grund im Nachweis.
          </p>
          <Field
            name="reason"
            label="Grund"
            placeholder="zum Beispiel Wunsch per E-Mail"
            maxLength={300}
            required
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton variant="danger" pendingLabel="Wird abgemeldet …">
            Abmelden
          </SubmitButton>
        </DialogFooter>
      </ActionForm>
    </Dialog>
  );
}
