"use client";

import { applyDiscountToExistingAction } from "@/lib/subscriptions/admin-actions";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";

/**
 * Bestätigung "Standardrabatt auf laufende Abos anwenden" (Figma 84:3025, Checkbox "Auch auf
 * laufende Abos anwenden"). Zeigt vorher, wie viele Abos betroffen sind. Angewendet wird nur, wo
 * der Rabatt steigt; weniger Rabatt wäre eine Preiserhöhung und wartet auf die Freigabe (I17).
 */
export function ApplyDiscountDialog({
  percentLabel,
  raise,
  lower,
}: {
  percentLabel: string;
  raise: number;
  lower: number;
}) {
  return (
    <Dialog
      title="Standardrabatt auf laufende Abos anwenden?"
      description={`Gespeicherter Standardrabatt: ${percentLabel}`}
      trigger={{ label: "Auf laufende Abos anwenden", variant: "secondary" }}
    >
      <ActionForm action={applyDiscountToExistingAction} closeDialogOnSuccess hideMessage>
        <DialogBody>
          <ActionFormMessage />
          <p className="text-[14px]">
            {raise === 0
              ? "Kein laufendes Abo hat weniger Rabatt als der Standard, es gibt nichts anzupassen."
              : `${raise} ${raise === 1 ? "laufendes Abo bekommt" : "laufende Abos bekommen"} ab der nächsten Lieferung ${percentLabel} Rabatt. Der Preis je Lieferung sinkt dadurch.`}
          </p>
          {lower > 0 ? (
            <FormMessage tone="warning" className="mb-0">
              {lower} {lower === 1 ? "Abo hat" : "Abos haben"} mehr Rabatt als der Standard und{" "}
              {lower === 1 ? "bleibt" : "bleiben"} unverändert. Weniger Rabatt wäre eine
              Preiserhöhung, die erst nach rechtlicher Freigabe und Ankündigung (I17) möglich ist.
            </FormMessage>
          ) : null}
          <p className="text-admin-text-2 text-[13px]">
            Jede Änderung landet als Ereignis am Abo und im Protokoll. Ungespeicherte Eingaben oben
            zählen nicht, speichere den Standardrabatt vorher.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton disabled={raise === 0} pendingLabel="Wird angewendet …">
            {raise === 0 ? "Nichts zu tun" : `Auf ${raise} Abos anwenden`}
          </SubmitButton>
        </DialogFooter>
      </ActionForm>
    </Dialog>
  );
}
