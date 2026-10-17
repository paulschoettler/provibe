import type { Metadata } from "next";
import { hasRole, PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { saveTrackingAction } from "@/lib/admin/settings/actions";
import { SECTION_HINTS } from "@/lib/admin/settings/schema";
import { getSettings } from "@/lib/admin/settings/settings";
import { resolveTrackingConfig } from "@/lib/tracking/config";
import { CONSENT_MAX_AGE_DAYS, CONSENT_VERSION } from "@/lib/tracking/consent";
import { NoAccess } from "@/components/admin/NoAccess";
import { Hint, InfoRow, ReadOnlyNotice } from "@/components/admin/content/parts";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { Field, Switch } from "@/components/admin/ui/fields";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SaveBar } from "@/components/admin/ui/SaveBar";

export const metadata: Metadata = { title: "Tracking" };

const PATH = "/admin/einstellungen/tracking";
const FORM = "tracking";

function ConsentBadge({ text }: { text: string }) {
  return (
    <Badge tone="accent" hollow>
      nur mit Einwilligung: {text}
    </Badge>
  );
}

/**
 * /admin/einstellungen/tracking (Figma 47:3253, mobil 52:4164): Meta-Pixel, Google Ads
 * (Conversion-ID und Labels), TikTok-Pixel, je mit Schalter. Gespeichert in shop_settings unter
 * "tracking" (öffentlich lesbar); die Storefront liest den Schlüssel über
 * src/lib/tracking/settings.ts, saveSettings erneuert danach das Layout aller Seiten.
 */
export default async function TrackingSettingsPage() {
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
        <PageHeader title="Tracking" />
        <FormMessage tone="error">
          Die Einstellungen konnten gerade nicht geladen werden.
        </FormMessage>
      </>
    );
  const t = settings.sections.tracking;
  // Was die Storefront mit dem gespeicherten Stand tatsächlich lädt (gleiche Logik wie dort)
  const effective = resolveTrackingConfig(
    {
      meta_enabled: t.metaEnabled,
      meta_pixel_id: t.metaPixelId,
      google_enabled: t.googleEnabled,
      google_ads_conversion_id: t.googleAdsConversionId,
      google_ads_labels: t.googleAdsLabels,
      tiktok_enabled: t.tiktokEnabled,
      tiktok_pixel_id: t.tiktokPixelId,
    },
    {
      NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
      NEXT_PUBLIC_GOOGLE_TAG_ID: process.env.NEXT_PUBLIC_GOOGLE_TAG_ID,
      NEXT_PUBLIC_TIKTOK_PIXEL_ID: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
    },
  );
  const active = [
    effective.meta ? "Meta" : null,
    effective.google ? "Google Ads" : null,
    effective.tiktok ? "TikTok" : null,
  ].filter(Boolean);
  const state = (on: string | null, enabled: boolean, id: string) =>
    on ? "aktiv" : enabled && !id ? "ID fehlt" : id ? "aus" : "Noch nicht eingerichtet";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <ActionForm
        id={FORM}
        action={saveTrackingAction}
        resetOnSuccess={false}
        hideMessage
        className="min-w-0"
      >
        <PageHeader title="Tracking" description="Pixel und Conversion-IDs für Marketing" />
        {!canEdit ? <ReadOnlyNotice what="Einstellungen" /> : null}
        <Hint tone="accent" className="mb-4">
          {SECTION_HINTS.tracking}
        </Hint>
        <ActionFormMessage className="mb-4" />
        <input type="hidden" name="tracking.ga4MeasurementId" value={t.ga4MeasurementId} />
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-bold">Meta Pixel</h2>
                <ConsentBadge text="Marketing" />
              </div>
              <Switch
                name="tracking.metaEnabled"
                label="Meta Pixel und Conversions API"
                description={`Stand: ${state(effective.meta, t.metaEnabled, t.metaPixelId)}. Pixel aus der Analyse: 1372318701489027 (H26, noch zu bestätigen).`}
                defaultChecked={t.metaEnabled}
              />
              <Field
                name="tracking.metaPixelId"
                label="Pixel-ID"
                defaultValue={t.metaPixelId}
                inputMode="numeric"
                placeholder="Noch keine ID hinterlegt"
              />
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-bold">Google Ads</h2>
                <ConsentBadge text="Marketing" />
              </div>
              <Switch
                name="tracking.googleEnabled"
                label="Google-Ads-Tag mit Conversion-Tracking"
                description={`Stand: ${state(effective.google, t.googleEnabled, t.googleAdsConversionId)}. Consent Mode v2, Enhanced Conversions nur mit Einwilligung.`}
                defaultChecked={t.googleEnabled}
              />
              <Field
                name="tracking.googleAdsConversionId"
                label="Conversion-ID"
                defaultValue={t.googleAdsConversionId}
                placeholder="AW-XXXXXXXXX"
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Field
                  name="tracking.label_purchase"
                  label="Label Kauf"
                  defaultValue={t.googleAdsLabels.purchase ?? ""}
                  placeholder="AbCdEfGh"
                />
                <Field
                  name="tracking.label_sign_up"
                  label="Label Newsletter"
                  defaultValue={t.googleAdsLabels.sign_up ?? ""}
                />
                <Field
                  name="tracking.label_generate_lead"
                  label="Label Partneranfrage"
                  defaultValue={t.googleAdsLabels.generate_lead ?? ""}
                />
              </div>
              <p className="text-admin-text-2 text-[12px]">
                GA4 (Statistik) lädt die Storefront nicht, weil es laut H25 noch keinen
                Statistik-Anbieter im Consent gibt
                {t.ga4MeasurementId ? ` (gespeichert: ${t.ga4MeasurementId})` : ""}.
              </p>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-bold">TikTok Pixel</h2>
                <ConsentBadge text="Marketing" />
              </div>
              <Switch
                name="tracking.tiktokEnabled"
                label="TikTok Pixel und Events API"
                description={`Stand: ${state(effective.tiktok, t.tiktokEnabled, t.tiktokPixelId)}.`}
                defaultChecked={t.tiktokEnabled}
              />
              <Field
                name="tracking.tiktokPixelId"
                label="Pixel-ID"
                defaultValue={t.tiktokPixelId}
                placeholder="Noch keine ID hinterlegt"
              />
            </div>
          </Card>
        </fieldset>
        {canEdit ? <SaveBar formId={FORM} /> : null}
      </ActionForm>

      <div className="flex min-w-0 flex-col gap-4">
        <Card title="Consent-Banner">
          <dl>
            <InfoRow label="Textversion">{CONSENT_VERSION}</InfoRow>
            <InfoRow label="Statistik">keiner (H25)</InfoRow>
            <InfoRow label="Marketing">Meta, Google Ads, TikTok</InfoRow>
            <InfoRow label="Gerade aktiv">{active.length ? active.join(", ") : "nichts"}</InfoRow>
            <InfoRow label="Gültigkeit">
              {CONSENT_MAX_AGE_DAYS / 30 >= 12 ? "12 Monate" : `${CONSENT_MAX_AGE_DAYS} Tage`}
            </InfoRow>
          </dl>
          <p className="text-admin-text-2 mt-2 text-[12px]">
            Jede Entscheidung wird mit Zeitstempel und Textversion protokolliert (consent_logs).
          </p>
        </Card>
        <Hint>
          Die drei Anbieter oben stehen schon im Banner und in der Datenschutzerklärung. Kommt ein
          neuer Anbieter oder eine neue Kategorie dazu (zum Beispiel GA4 als Statistik), braucht es
          einen neuen Banner-Text mit neuer Version (CONSENT_VERSION in src/lib/tracking/consent.ts)
          und einen Absatz in der Datenschutzerklärung. Dann fragt das Banner alle Besucher neu.
        </Hint>
      </div>
    </div>
  );
}
