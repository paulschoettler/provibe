import {
  adjustStockAction,
  setThresholdAction,
  setTrackingAction,
} from "@/lib/admin/inventory/actions";
import { ADJUST_REASONS } from "@/lib/admin/inventory/rules";
import { ActionForm, ActionFormMessage } from "@/components/admin/ui/ActionForm";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Field, Select, Switch, Textarea } from "@/components/admin/ui/fields";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { RemountOnError } from "@/components/admin/orders/RemountOnError";

/**
 * Formulare der Bestandsseite: Buchung mit Grund (Korrektur, Wareneingang, Schwund, Retoure),
 * Warnschwelle, Bestandsführung. Server Components mit ActionForm, funktionieren ohne JavaScript
 * (der Dialog "Buchen" braucht JavaScript, im Drawer steht dasselbe Formular ohne Dialog).
 */

const REASON_OPTIONS = ADJUST_REASONS.map((r) => ({
  value: r.value,
  label: `${r.label}${r.sign === "positive" ? " (+)" : r.sign === "negative" ? " (−)" : " (±)"}`,
}));

function AdjustFields({ variantId }: { variantId: string }) {
  return (
    <RemountOnError className="flex flex-col gap-3">
      <input type="hidden" name="variantId" value={variantId} />
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field
          name="delta"
          label="Menge"
          inputMode="numeric"
          placeholder="+24 oder -3"
          required
          hint="Stück dieser Variante"
        />
        <Select
          name="reason"
          label="Grund"
          placeholder="Bitte wählen"
          options={REASON_OPTIONS}
          required
        />
      </div>
      <Textarea
        name="note"
        label="Notiz"
        rows={2}
        maxLength={500}
        hint="Bei Korrektur Pflicht, zum Beispiel Inventur vom 17.10."
      />
    </RemountOnError>
  );
}

export function AdjustStockForm({ variantId }: { variantId: string }) {
  return (
    <ActionForm action={adjustStockAction} className="flex flex-col gap-3">
      <AdjustFields variantId={variantId} />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Wird gebucht …">Buchen</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AdjustStockDialog({ variantId, label }: { variantId: string; label: string }) {
  return (
    <Dialog
      title="Bestand buchen"
      description={label}
      trigger={{ label: "Buchen", variant: "secondary", className: "h-9 md:h-8 text-[13px]" }}
    >
      <ActionForm action={adjustStockAction} closeDialogOnSuccess hideMessage>
        <DialogBody>
          <ActionFormMessage />
          <AdjustFields variantId={variantId} />
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton pendingLabel="Wird gebucht …">Buchen</SubmitButton>
        </DialogFooter>
      </ActionForm>
    </Dialog>
  );
}

export function ThresholdForm({ variantId, value }: { variantId: string; value: number }) {
  return (
    <ActionForm action={setThresholdAction} className="flex items-end gap-2" resetOnSuccess={false}>
      <input type="hidden" name="variantId" value={variantId} />
      <Field
        name="threshold"
        label="Warnschwelle"
        inputMode="numeric"
        defaultValue={String(value)}
        className="w-32"
      />
      <SubmitButton variant="secondary" pendingLabel="…">
        Speichern
      </SubmitButton>
    </ActionForm>
  );
}

export function TrackingForm({
  variantId,
  trackInventory,
  allowBackorder,
}: {
  variantId: string;
  trackInventory: boolean;
  allowBackorder: boolean;
}) {
  return (
    <ActionForm action={setTrackingAction} className="flex flex-col gap-3" resetOnSuccess={false}>
      <input type="hidden" name="variantId" value={variantId} />
      <Switch
        name="trackInventory"
        label="Bestand führen"
        defaultChecked={trackInventory}
        description="Aus: unbegrenzt verkaufbar (bis zum Import, Entscheidung H3). An: ausverkauft bei 0."
      />
      <Switch
        name="allowBackorder"
        label="Verkauf bei 0 erlauben"
        defaultChecked={allowBackorder}
        description="Nachbestellung, der Bestand darf ins Minus laufen."
      />
      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingLabel="…">
          Bestandsführung speichern
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
