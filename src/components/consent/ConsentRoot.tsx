import { TrackingRuntime } from "@/components/tracking/TrackingRuntime";
import { CONSENT_COOKIE, CONSENT_VERSION } from "@/lib/tracking/consent";
import { getTrackingConfig } from "@/lib/tracking/settings";
import { ConsentBanner } from "./ConsentBanner";
import { ConsentDialog } from "./ConsentDialog";

/**
 * Einstieg für das Root-Layout (innerhalb von CartProvider, nach CartDrawer): Banner, Dialog und
 * Tracking-Laufzeit. Server Component ohne Cookies, damit Layout und Seiten statisch bleiben;
 * die Tracking-IDs der eingeschalteten Dienste kommen aus shop_settings.
 *
 * Kein Pixel-Skript im Server-HTML: Die Anbieter lädt erst der Browser nach Einwilligung.
 * Das kleine Inline-Skript prüft nur, ob schon eine gültige Entscheidung vorliegt, und blendet
 * das Banner dann vor dem ersten Zeichnen aus (kein Aufblitzen, keine Layout-Verschiebung).
 */
const HIDE_IF_DECIDED =
  "(function(){try{var m=document.cookie.match(/(?:^|; )" +
  CONSENT_COOKIE +
  "=([^;]*)/);if(m&&m[1].indexOf(" +
  JSON.stringify(`${CONSENT_VERSION}~`) +
  ")===0)document.documentElement.setAttribute('data-consent-decided','')}catch(e){}})()";

export async function ConsentRoot() {
  const config = await getTrackingConfig();
  const activeVendors = {
    meta: Boolean(config.meta),
    google: Boolean(config.google),
    tiktok: Boolean(config.tiktok),
  };
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HIDE_IF_DECIDED }} />
      <ConsentBanner />
      <ConsentDialog activeVendors={activeVendors} />
      <TrackingRuntime config={config} />
    </>
  );
}

export default ConsentRoot;
