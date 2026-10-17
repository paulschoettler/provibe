import type { Metadata } from "next";
import { hasRole, PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { centsToEuroInput } from "@/lib/admin/content/input";
import { saveShopDataAction } from "@/lib/admin/settings/actions";
import { SECTION_HINTS } from "@/lib/admin/settings/schema";
import { getSettings } from "@/lib/admin/settings/settings";
import { serverEnv } from "@/lib/env/server";
import { NoAccess } from "@/components/admin/NoAccess";
import { Hint, ReadOnlyNotice } from "@/components/admin/content/parts";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Card } from "@/components/admin/ui/Card";
import { Field, Textarea } from "@/components/admin/ui/fields";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SaveBar } from "@/components/admin/ui/SaveBar";

export const metadata: Metadata = { title: "Shopdaten" };

const PATH = "/admin/einstellungen/shopdaten";
const FORM = "shopdaten";

/**
 * /admin/einstellungen/shopdaten: Firmendaten (Impressum, Mails, Rechnungen), Kontakt- und
 * Support-Adressen, Social-Links, Mail-Absender und Text der Kontaktseite. Ein Formular, das
 * nur geänderte Abschnitte speichert (Zod je Abschnitt aus schema.ts, Audit je Abschnitt).
 */
export default async function ShopDataPage() {
  const session = await requireStaff("support", { next: PATH });
  if (!hasRole(session, "admin")) return <NoAccess />;
  const canEdit = PERMISSIONS.editSettings(session);
  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  try {
    settings = await getSettings();
  } catch {
    settings = null;
  }
  if (!settings)
    return (
      <>
        <PageHeader title="Shopdaten" />
        <FormMessage tone="error">
          Die Einstellungen konnten gerade nicht geladen werden.
        </FormMessage>
      </>
    );
  const { shop, legalEntity: le, contact, social, sender, contactPage } = settings.sections;
  const env = serverEnv();

  return (
    <ActionForm id={FORM} action={saveShopDataAction} resetOnSuccess={false} hideMessage>
      <PageHeader
        title="Shopdaten"
        description="Firmendaten, Adressen und Kontakt für Impressum, E-Mails, Rechnungen und Kontaktseite"
      />
      {!canEdit ? <ReadOnlyNotice what="Einstellungen" /> : null}
      <ActionFormMessage className="mb-4" />
      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
        <Card title="Firma" description={SECTION_HINTS.legalEntity}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              name="legalEntity.name"
              label="Firmenname"
              defaultValue={le.name}
              required
              className="md:col-span-2"
            />
            <Field
              name="legalEntity.managingDirector"
              label="Geschäftsführung"
              defaultValue={le.managingDirector}
              required
            />
            <Field
              name="legalEntity.register"
              label="Handelsregister"
              defaultValue={le.register}
              placeholder="Amtsgericht Augsburg, HRB …"
            />
            <Field
              name="legalEntity.vatId"
              label="USt-IdNr."
              defaultValue={le.vatId}
              placeholder="DE…"
            />
            <Field
              name="legalEntity.lucidNumber"
              label="LUCID-Nummer (Verpackungsregister)"
              defaultValue={le.lucidNumber}
              placeholder="DE…"
              hint="Fehlt noch (B13, H8). Erscheint im Impressum, sobald eingetragen."
            />
          </div>
        </Card>

        <Card
          title="Adresse"
          description="Anschrift im Impressum, Absender auf Rechnungen und Rücksendeadresse (H5)"
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_90px]">
            <Field
              name="legalEntity.street"
              label="Straße und Hausnummer"
              defaultValue={le.street}
              required
              className="md:col-span-4"
            />
            <Field
              name="legalEntity.zip"
              label="PLZ"
              defaultValue={le.zip}
              required
              inputMode="numeric"
            />
            <Field
              name="legalEntity.city"
              label="Ort"
              defaultValue={le.city}
              required
              className="md:col-span-2"
            />
            <Field
              name="legalEntity.country"
              label="Land"
              defaultValue={le.country}
              maxLength={2}
              required
            />
            <Field
              name="legalEntity.phone"
              label="Telefon"
              defaultValue={le.phone}
              type="tel"
              className="md:col-span-2"
            />
            <Field
              name="legalEntity.email"
              label="E-Mail im Impressum"
              defaultValue={le.email}
              type="email"
              required
              className="md:col-span-2"
            />
          </div>
        </Card>

        <Card
          title="Kontakt und Support"
          description="Adressen auf Kontakt-, Partner- und Widerrufsseite"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              name="contact.email"
              label="Allgemeiner Kontakt"
              defaultValue={contact.email}
              type="email"
              required
            />
            <Field
              name="contact.supportEmail"
              label="Support (Widerruf)"
              defaultValue={contact.supportEmail}
              type="email"
              required
              hint="Nur nutzen, wenn das Postfach täglich abgerufen wird (I8)."
            />
            <Field
              name="contact.partnerEmail"
              label="Partner und B2B"
              defaultValue={contact.partnerEmail}
              type="email"
              required
            />
            <Field
              name="contact.phone"
              label="Telefon (Kontaktseite)"
              defaultValue={contact.phone}
              type="tel"
            />
            <Textarea
              name="contactPage.openingText"
              label="Erreichbarkeit (Kontaktseite)"
              defaultValue={contactPage.openingText}
              rows={2}
              maxLength={400}
              className="md:col-span-2"
              hint="Zum Beispiel Antwortzeit oder Bürozeiten."
            />
          </div>
        </Card>

        <Card title="E-Mail-Absender" description="Absender und Antwortadresse der Shop-Mails">
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              name="sender.fromName"
              label="Absendername"
              defaultValue={sender.fromName}
              required
            />
            <Field
              name="sender.fromEmail"
              label="Absenderadresse"
              defaultValue={sender.fromEmail}
              type="email"
              required
            />
            <Field
              name="sender.replyTo"
              label="Antworten an"
              defaultValue={sender.replyTo}
              type="email"
            />
          </div>
          <Hint tone="info" className="mt-4">
            Aktiv versendet wird zurzeit mit{" "}
            {env.EMAIL_FROM_TRANSACTIONAL ?? "dem Absender aus der Umgebung"}
            {env.APP_INTEGRATIONS === "mock" ? " (Testmodus, Mails gehen an den Mock)" : ""}. Die
            Absenderdomain muss in Resend verifiziert sein (SPF, DKIM, DMARC).
          </Hint>
        </Card>

        <Card title="Social Media" description="Links im Footer und auf der Kontaktseite">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              name="social.instagram"
              label="Instagram"
              defaultValue={social.instagram}
              type="url"
              placeholder="https://www.instagram.com/…"
            />
            <Field
              name="social.tiktok"
              label="TikTok"
              defaultValue={social.tiktok}
              type="url"
              placeholder="https://www.tiktok.com/@…"
            />
          </div>
        </Card>

        <Card
          title="Shop"
          description="Name, Standard-Lieferzeit und Pfand-Standardwert für neue Produkte"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="shop.name" label="Shopname" defaultValue={shop.name} required />
            <Field name="shop.tagline" label="Claim" defaultValue={shop.tagline} />
            <Field
              name="shop.defaultDeliveryTime"
              label="Standard-Lieferzeit"
              defaultValue={shop.defaultDeliveryTime}
              required
              hint="Gilt, wenn ein Produkt keine eigene Lieferzeit hat."
            />
            <Field
              name="shop.deposit"
              label="Pfand je Dose (Standard)"
              defaultValue={centsToEuroInput(shop.depositDefaultCents)}
              suffix="€"
              inputMode="decimal"
              hint="Pfand steht getrennt vom Preis (H22), der Wert je Produkt bleibt maßgeblich."
            />
          </div>
        </Card>
      </fieldset>
      {canEdit ? <SaveBar formId={FORM} /> : null}
    </ActionForm>
  );
}
