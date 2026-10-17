"use client";

import { inviteStaffAction } from "@/lib/admin/staff/user-actions";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Dialog, DialogBody, DialogClose, DialogFooter } from "@/components/admin/ui/Dialog";
import { Field, RadioCards } from "@/components/admin/ui/fields";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { ROLE_OPTIONS } from "@/lib/admin/staff/rules";

/** Einladen-Dialog nach Figma (50:3732): E-Mail, Rolle als Karten, Hinweis zur Zwei-Faktor-Einrichtung. */

export function InviteDialog({ defaultOpen, block }: { defaultOpen?: boolean; block?: boolean }) {
  return (
    <Dialog
      title="Benutzer einladen"
      description="Die Person bekommt eine E-Mail mit Link zur Anmeldung."
      trigger={{ label: "Benutzer einladen", variant: "primary", block }}
      defaultOpen={defaultOpen}
    >
      <ActionForm action={inviteStaffAction} closeDialogOnSuccess hideMessage>
        <DialogBody>
          <ActionFormMessage />
          <Field
            name="email"
            label="E-Mail"
            type="email"
            placeholder="name@provibe-drinks.de"
            required
            autoComplete="off"
          />
          <RadioCards name="role" legend="Rolle" options={ROLE_OPTIONS} defaultValue="support" />
          <FormMessage tone="info" className="mb-0">
            Beim ersten Login richtet die Person die Zwei-Faktor-Anmeldung ein. Die Einladung landet
            im Protokoll.
          </FormMessage>
        </DialogBody>
        <DialogFooter>
          <DialogClose />
          <SubmitButton pendingLabel="Wird gesendet …">Einladung senden</SubmitButton>
        </DialogFooter>
      </ActionForm>
    </Dialog>
  );
}
