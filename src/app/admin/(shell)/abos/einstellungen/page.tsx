import type { Metadata } from "next";
import { PERMISSIONS, requireStaff } from "@/lib/admin/auth";
import { subscriptionUnitPriceCents } from "@/lib/pricing/subscription";
import { getSettings } from "@/lib/subscriptions/admin";
import { countDiscountApplication } from "@/lib/subscriptions/admin-queries";
import { loadSubscribableProducts, type SubscribableProduct } from "@/lib/subscriptions/catalog";
import { PRICE_NOTICE_DAYS } from "@/lib/subscriptions/rules";
import type { SubscriptionSettings } from "@/lib/subscriptions/types";
import { saveSubscriptionSettingsAction } from "@/lib/subscriptions/admin-actions";
import { NoAccess } from "@/components/admin/NoAccess";
import { ActionForm, ActionFormMessage, FormMessage } from "@/components/admin/ui/ActionForm";
import { Badge } from "@/components/admin/ui/Badge";
import { Card } from "@/components/admin/ui/Card";
import { Checkbox, Field, Select } from "@/components/admin/ui/fields";
import { formatMoney } from "@/components/admin/ui/format";
import { Icon } from "@/components/admin/ui/Icon";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SaveBar } from "@/components/admin/ui/SaveBar";
import { ApplyDiscountDialog } from "@/components/admin/subscriptions/ApplyDiscountDialog";
import { intervalText, percentFromBp } from "@/components/admin/subscriptions/labels";

export const metadata: Metadata = { title: "Abo-Einstellungen" };

const PATH = "/admin/abos/einstellungen";
const FORM = "abo-einstellungen";
/** Auswahl im Formular; gespeicherte Werte außerhalb dieser Liste erscheinen zusätzlich */
const INTERVAL_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10, 12];

function pctInput(bp: number): string {
  return (bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

/** Abo-Preis der kleinsten Packgröße (Warenwert nach Rabatt, ohne Pfand) */
function example(p: SubscribableProduct, bp: number) {
  const v = p.variants[0];
  if (!v) return null;
  const goods = v.priceCents - v.depositCents;
  return { title: v.title, list: goods, abo: subscriptionUnitPriceCents(goods, bp) };
}

/**
 * /admin/abos/einstellungen (Figma 84:3025, mobil 84:3725): Standardrabatt, Rabatt je Produkt,
 * erlaubte Intervalle mit Standard, Erinnerungsvorlauf, Wiederholungsplan bei Zahlungsfehlern,
 * maximale Pause. Speichern über saveSettings (Owner, Admin), Support sieht die Werte nur.
 * Die Preisankündigung bleibt sichtbar, ist aber bis zur rechtlichen Freigabe (I17) gesperrt.
 */
export default async function AboSettingsPage() {
  const session = await requireStaff("support", { next: PATH });
  if (!PERMISSIONS.viewCustomers(session)) return <NoAccess />;
  const canEdit = PERMISSIONS.editSettings(session);

  let settings: SubscriptionSettings | null = null;
  let products: SubscribableProduct[] = [];
  let apply: { raise: number; lower: number } | null = null;
  try {
    settings = await getSettings();
    [products, apply] = await Promise.all([
      loadSubscribableProducts().catch(() => []),
      canEdit ? countDiscountApplication(settings.discountBp) : Promise.resolve(null),
    ]);
  } catch (error) {
    console.error("[admin] Abo-Einstellungen", error);
  }
  if (!settings) {
    return (
      <>
        <PageHeader title="Abo-Einstellungen" backHref="/admin/abos" backLabel="Abos" />
        <FormMessage tone="error">
          Die Einstellungen konnten gerade nicht geladen werden.
        </FormMessage>
      </>
    );
  }
  const s = settings;
  const intervalChoices = [...new Set([...INTERVAL_CHOICES, ...s.intervals])].sort((a, b) => a - b);
  const first = products[0];
  const firstExample = first ? example(first, s.discountBp) : null;
  const variantOverrides = Object.entries(s.productDiscounts.variants);
  const variantTitle = new Map(
    products.flatMap((p) => p.variants.map((v) => [v.id, `${p.title} ${v.title}`] as const)),
  );

  return (
    <>
      <ActionForm
        id={FORM}
        action={saveSubscriptionSettingsAction}
        resetOnSuccess={false}
        hideMessage
      >
        <PageHeader
          title="Abo-Einstellungen"
          backHref="/admin/abos"
          backLabel="Abos"
          description="Rabatt, Intervalle, Erinnerung und Zahlungswiederholungen für Abos"
        />
        {!canEdit ? (
          <FormMessage tone="info">
            Du siehst die Einstellungen nur. Ändern dürfen Owner und Admin.
          </FormMessage>
        ) : null}
        <ActionFormMessage className="mb-4" />
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
          <Card
            title="Standardrabatt"
            description="Gilt für alle abonnierbaren Packgrößen, sofern unten nichts anderes steht."
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-end">
              <Field
                name="discountPercent"
                label="Rabatt in Prozent"
                defaultValue={pctInput(s.discountBp)}
                inputMode="decimal"
                suffix="%"
                required
              />
              {firstExample ? (
                <div className="rounded-admin-feld bg-admin-flaeche p-3 text-[13px]">
                  <p className="text-admin-text-2">
                    Beispiel {first!.title} {firstExample.title}
                  </p>
                  <p className="text-[15px] font-semibold">
                    {formatMoney(firstExample.list)} einmalig, {formatMoney(firstExample.abo)} im
                    Abo
                  </p>
                  <p className="text-admin-text-2">
                    Warenwert ohne Pfand, nach dem gespeicherten Rabatt. Pfand und Versand bleiben
                    gleich.
                  </p>
                </div>
              ) : null}
            </div>
            <FormMessage tone="warning" className="mt-4 mb-0">
              Neue Werte gelten nur für neue Abos (der Rabatt wird beim Abschluss gespeichert). Für
              laufende Abos gibt es unten die Aktion &quot;Auf laufende Abos anwenden&quot;.
            </FormMessage>
          </Card>

          <Card
            title="Rabatt je Produkt"
            description="Die genaueste Regel gewinnt: Packgröße vor Produkt vor Standard. Leeres Feld heißt Standard."
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <caption className="sr-only">Rabatt je Produkt</caption>
                <thead>
                  <tr className="bg-admin-flaeche text-admin-text-2 border-admin-rahmen border-y text-left text-[13px]">
                    <th scope="col" className="px-4 py-2.5 font-normal">
                      Produkt
                    </th>
                    <th scope="col" className="w-[150px] px-4 py-2.5 font-normal">
                      Rabatt
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-normal max-md:hidden">
                      Quelle
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-normal max-md:hidden">
                      Abo-Preis Beispiel
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const own = s.productDiscounts.products[p.id];
                    const ex = example(p, own ?? s.discountBp);
                    return (
                      <tr key={p.id} className="border-admin-rahmen border-b last:border-b-0">
                        <th scope="row" className="px-4 py-2 text-left font-semibold">
                          {p.title}
                          <span className="text-admin-text-2 block text-[12px] font-normal">
                            alle Packgrößen
                          </span>
                        </th>
                        <td className="px-4 py-2">
                          <Field
                            name={`product_${p.id}`}
                            label={`Rabatt für ${p.title}`}
                            hideLabel
                            inputMode="decimal"
                            defaultValue={own !== undefined ? pctInput(own) : ""}
                            placeholder="Standard"
                            suffix="%"
                          />
                        </td>
                        <td className="px-4 py-2 max-md:hidden">
                          {own !== undefined ? (
                            <Badge tone="accent">Abweichend</Badge>
                          ) : (
                            <Badge tone="gray">Standard</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 tabular-nums max-md:hidden">
                          {ex ? `${ex.title} ${formatMoney(ex.abo)}` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-admin-text-2 px-4 py-3">
                        Keine abonnierbaren Produkte gefunden.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {variantOverrides.length ? (
              <p className="text-admin-text-2 border-admin-rahmen border-t px-4 py-3 text-[13px]">
                Eigene Rabatte je Packgröße (bleiben erhalten):{" "}
                {variantOverrides
                  .map(
                    ([id, bp]) => `${variantTitle.get(id) ?? id.slice(0, 8)} ${percentFromBp(bp)}`,
                  )
                  .join(", ")}
              </p>
            ) : null}
          </Card>

          <Card
            title="Erlaubte Intervalle"
            description="Diese Intervalle sehen Kunden auf der Produktseite, im Checkout und im Kundenportal."
          >
            <fieldset>
              <legend className="sr-only">Intervalle</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {intervalChoices.map((w) => (
                  <Checkbox
                    key={w}
                    name="intervals"
                    value={String(w)}
                    defaultChecked={s.intervals.includes(w)}
                    label={intervalText(w)}
                  />
                ))}
              </div>
            </fieldset>
            <Select
              name="defaultInterval"
              label="Standardintervall"
              className="mt-4 md:max-w-[280px]"
              defaultValue={String(s.defaultInterval)}
              options={intervalChoices.map((w) => ({ value: String(w), label: intervalText(w) }))}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Erinnerung"
              description='E-Mail "Deine nächste Lieferung kommt" mit Links zum Überspringen und Ändern.'
            >
              <Field
                name="reminderDays"
                label="Vorlauf in Tagen"
                type="number"
                min={1}
                max={14}
                defaultValue={String(s.reminderDays)}
                required
                hint={`Geht ${s.reminderDays} Tage vor der Abbuchung raus. Bis dahin kann der Kunde alles ändern.`}
              />
            </Card>
            <Card
              title="Zahlungsfehler"
              description="Was passiert, wenn eine Abbuchung abgelehnt wird."
            >
              <Field
                name="retryDays"
                label="Wiederholungen (Tage nach dem ersten Fehlschlag)"
                defaultValue={s.retryDays.join(", ")}
                placeholder="3, 7"
                hint={
                  s.retryDays.length
                    ? `Heute: Tag ${s.retryDays.join(" und Tag ")}. Danach wird das Abo pausiert.`
                    : "Keine Wiederholung: Das Abo wird nach dem ersten Fehlschlag pausiert."
                }
              />
              <p className="text-admin-text-2 mt-3 text-[13px]">
                Kunden bekommen bei jedem Fehlschlag die E-Mail &quot;Zahlung fehlgeschlagen&quot;
                mit Link zum Zahlungsmittel. Bei 3-D Secure kommt ein Bestätigungslink.
              </p>
            </Card>
            <Card
              title="Pause"
              description="Wie lange Kunden ein Abo höchstens pausieren können (H25)."
            >
              <Field
                name="pauseMaxDays"
                label="Maximale Pause in Tagen"
                type="number"
                min={7}
                max={183}
                defaultValue={String(s.pauseMaxDays)}
                required
                hint="Höchstens 183 Tage (6 Monate)."
              />
            </Card>
            <Card
              title="Preisankündigung"
              description="Preiserhöhungen für laufende Abos mit Ankündigung per E-Mail."
              className="opacity-70"
            >
              <div aria-disabled="true" className="flex flex-col gap-3">
                <div className="rounded-admin-feld bg-admin-flaeche text-admin-text-2 flex items-center justify-between gap-3 p-3 text-[14px]">
                  <span>Vorlauf der Ankündigung</span>
                  <span className="font-semibold">{PRICE_NOTICE_DAYS} Tage</span>
                </div>
                <p className="text-admin-text-2 flex items-start gap-2 text-[13px]">
                  <Icon name="schloss" size={16} />
                  <span>
                    Wartet auf rechtliche Freigabe (I17). Ohne wirksame Preisanpassungsklausel
                    werden keine Ankündigungen verschickt.
                  </span>
                </p>
              </div>
            </Card>
          </div>

          <p className="rounded-admin-feld bg-admin-flaeche text-admin-text-2 flex items-center gap-2 p-3 text-[13px]">
            <Icon name="info" size={16} />
            Jede Änderung landet mit Benutzer und Zeit im Protokoll. Speichern dürfen Owner und
            Admin.
          </p>
        </fieldset>
        {canEdit ? <SaveBar formId={FORM} /> : null}
      </ActionForm>

      {canEdit && apply ? (
        <Card
          title="Laufende Abos"
          description="Den gespeicherten Standardrabatt ausdrücklich auf bestehende Abos übertragen."
          className="mt-4"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[14px]">
              {apply.raise === 0
                ? "Alle laufenden Abos haben mindestens den Standardrabatt."
                : `${apply.raise} laufende ${apply.raise === 1 ? "Abo hat" : "Abos haben"} weniger als ${percentFromBp(s.discountBp)} Rabatt.`}
            </p>
            <ApplyDiscountDialog
              percentLabel={percentFromBp(s.discountBp)}
              raise={apply.raise}
              lower={apply.lower}
            />
          </div>
        </Card>
      ) : null}
    </>
  );
}
