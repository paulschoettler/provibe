# Consent und Tracking

Stand 17.10.2026. Umsetzung von Briefing Abschnitt 5 (Consent nach TDDDG und DSGVO) und Abschnitt 6 (Tracking, consent-gesteuert). Figma Seite 07, Sektion 75:1822.

## Kurzfassung

- Ohne Entscheidung im Banner lädt kein Anbieter-Skript und es wird kein nicht notwendiges Cookie gesetzt. Das Server-HTML enthält nie ein Pixel-Skript.
- Kein Dienst ist aktiv, solange im Backoffice keine ID eingetragen ist. Die Meta-Pixel-ID aus der Analyse (`1372318701489027`) ist nur ein Vorschlag und **nicht** eingetragen.
- Kategorie Statistik ist sichtbar, aber ausgegraut, weil es laut H25 keinen Statistik-Anbieter gibt.
- Serverseitig wird nichts an Meta, Google oder TikTok gesendet. Events landen nur im Protokoll `tracking_events` (Vorbereitung Conversions API).

## Consent-Cookie (für die Datenschutzerklärung, DS-15)

| Name         | Zweck                                            | Speicherdauer        | Art                                     |
| ------------ | ------------------------------------------------ | -------------------- | --------------------------------------- |
| `pv_consent` | Speichert die Cookie-Wahl                        | 12 Monate (365 Tage) | notwendig, Erstanbieter, nicht httpOnly |
| `pv_track_q` | Gibt ein Formular-Event einmal an Dienste weiter | 5 Minuten            | nur mit Marketing-Einwilligung          |

Formulierungsvorschlag für den [OFFEN]-Marker in DS-15: "`pv_consent` (12 Monate): speichert Ihre Auswahl im Cookie-Banner." Für den Marketing-Absatz: "`pv_track_q` (5 Minuten, nur nach Einwilligung): gibt ein Ereignis aus einem Formular, zum Beispiel einer Newsletter-Anmeldung, einmal an die von Ihnen erlaubten Dienste weiter."

Format von `pv_consent` (keine personenbezogenen Daten, Felder mit `~`):

```
<Textversion>~<Kennung>~<Zeitpunkt Unix-Sekunden>~<Auswahl>
2026-10-17~k3j4h5g6f7d8s9a0q1w2~1760702400~mgt
```

Auswahl: `-` nur notwendige, sonst `s` Statistik (derzeit nie), `m` Meta, `g` Google Ads, `t` TikTok. Die Kennung ist zufällig (20 Zeichen a-z0-9) und verknüpft den Cookie mit `consent_logs.anonymous_id`. Ist die Textversion älter als `CONSENT_VERSION` (`src/lib/tracking/consent.ts`), erscheint das Banner neu.

**Wann `CONSENT_VERSION` erhöhen:** bei jeder Änderung von Banner- oder Dialogtext, Kategorien oder Anbietern, insbesondere wenn ein Dienst neu eingeschaltet wird oder ein Statistik-Anbieter dazukommt.

## Ablauf der Einwilligung

1. Das Banner steht immer im Server-HTML (Layout bleibt statisch). Ein kleines Inline-Skript in `ConsentRoot` prüft vor dem Zeichnen, ob `pv_consent` mit aktueller Version existiert, und setzt dann `data-consent-decided` auf `<html>`; CSS blendet das Banner aus. Kein Aufblitzen, keine Layout-Verschiebung (das Banner liegt fest über der Seite).
2. Erste Ebene: "Alle akzeptieren" und "Nur notwendige" gleich groß, gleich gefärbt, gleich gewichtet, kein Schließen-X, Link "Einstellungen". Das Banner nimmt beim Laden keinen Fokus, ist per Tab erreichbar und als Region mit Überschrift beschriftet.
3. Zweite Ebene: Dialog (natives `<dialog>`) beziehungsweise Seite `/cookie-einstellungen` mit Notwendig (immer an), Statistik (ausgegraut), Marketing mit Hauptschalter und Schaltern je Anbieter samt Zweck, Anbieter, Speicherdauer und Datenschutzlink. Buttons "Auswahl speichern" und "Alle akzeptieren"; liegt eine Einwilligung vor, zusätzlich "Einwilligung widerrufen, nur notwendige".
4. Mit JavaScript: Der Browser setzt den Cookie sofort, dann ruft er die Server Action `logConsent` auf. Diese setzt den Cookie noch einmal per `Set-Cookie` (volle Laufzeit auch in Safari, das per Skript gesetzte Cookies auf 7 Tage kürzt) und schreibt `consent_logs`.
5. Ohne JavaScript: Die Buttons sind normale Formulare auf die Server Action `saveConsentForm`, die Cookie und Protokoll schreibt und zurückleitet (auf `/cookie-einstellungen` mit `?gespeichert=1`). Das Banner bleibt ohne JavaScript sichtbar, weil das statische HTML den Cookie nicht kennt; es blockiert nichts.
6. Widerruf jederzeit: Footer-Link "Cookie-Einstellungen" (öffnet den Dialog, ohne JavaScript die Seite). Beim Entzug einer Einwilligung meldet der Browser den Widerruf an die geladenen Dienste (`fbq('consent','revoke')`, Consent Mode `denied`, `ttq.revokeConsent()`), löscht deren Erstanbieter-Cookies (`_fbp`, `_fbc`, `_gcl_*`, `_ttp`, `_tt_enable_cookie`, `ttcsid`) und lädt die Seite neu, damit kein Skript im Speicher bleibt.

### Protokoll `consent_logs`

Je Entscheidung eine Zeile: `anonymous_id`, `action` (`accept_all`, `reject_all`, `custom`, `withdraw`), `categories` (`{necessary, analytics, marketing, vendors: {meta, google, tiktok}}`), `banner_version`, `ip_hash` (gesalzener SHA-256, gekürzt, wie beim Rate Limit), `user_agent` (gekürzt auf 120 Zeichen), `page_url` (nur Pfad, Tokens ersetzt), `created_at` (UTC). Rate Limit 60 Einträge je Stunde und IP-Hash. Schreibzugriff nur über den Service-Role-Client.

## Event-Schema

Typen in `src/lib/tracking/schema.ts`, Builder in `src/lib/tracking/builders.ts`. Beträge in Euro als Dezimalzahl, immer ohne Pfand, aus serverseitig gerechneten Werten.

| Event               | Quelle                                                             | Meta                 | Google (gtag)                | TikTok               |
| ------------------- | ------------------------------------------------------------------ | -------------------- | ---------------------------- | -------------------- |
| `page_view`         | `TrackingRuntime` je Pfad, Adresse bereinigt                       | PageView             | page_view                    | `ttq.page()`         |
| `view_item_list`    | Kollektion (`TrackCollectionView`)                                 | nicht gesendet       | view_item_list               | nicht gesendet       |
| `view_item`         | Produktseite (`TrackProductView`, Standardvariante)                | ViewContent          | view_item                    | ViewContent          |
| `search`            | `/search?q=` (`TrackSearch`)                                       | Search               | search                       | Search               |
| `add_to_cart`       | CartProvider (`addLine`, Mengen plus)                              | AddToCart            | add_to_cart                  | AddToCart            |
| `remove_from_cart`  | CartProvider (`removeLine`, Mengen minus)                          | nicht gesendet       | remove_from_cart             | nicht gesendet       |
| `view_cart`         | Drawer öffnen über das Icon, Seite `/cart`                         | nicht gesendet       | view_cart                    | nicht gesendet       |
| `begin_checkout`    | Server (Protokoll) und Browser auf `/checkout`, gleiche `event_id` | InitiateCheckout     | begin_checkout               | InitiateCheckout     |
| `add_shipping_info` | Server Action Adresse, über `pv_track_q`                           | nicht gesendet       | add_shipping_info            | nicht gesendet       |
| `add_payment_info`  | Server Action Zahlung, über `pv_track_q`                           | AddPaymentInfo       | add_payment_info             | AddPaymentInfo       |
| `purchase`          | Webhook-Job `tracking.purchase`, nur Protokoll (siehe unten)       | Purchase (Mapping)   | purchase plus Ads-Conversion | CompletePayment      |
| `sign_up`           | Newsletter-Anmeldung, über `pv_track_q`                            | CompleteRegistration | sign_up                      | CompleteRegistration |
| `generate_lead`     | Partnerformular, über `pv_track_q`                                 | Lead                 | generate_lead                | SubmitForm           |

Jedes Event bekommt eine `event_id` (Browser-Events zufällig, Server-Events deterministisch, zum Beispiel `purchase_<order.id>`), die Meta als `eventID` und TikTok als `event_id` mitbekommen. Damit lassen sich Browser- und Server-Events später deduplizieren.

`item_id`: SKU, wo sie bekannt ist (Produktseite, Kollektion, Checkout-Snapshot); im Warenkorb die Varianten-ID, weil `CartLineView` keine SKU enthält; beim Kauf der Produkttitel (`OrderViewItem` hat keine SKU). Vorschlag für eine spätere Welle: SKU in `CartLineView` und `OrderViewItem` aufnehmen, damit alle Events und der Katalogfeed dieselbe ID nutzen.

## Browser-Schicht

- `track(event)` (`src/components/tracking/track.ts`) schreibt jedes Event in `window.dataLayer` (neutral, ohne Netzwerk) und ruft die Adapter nur für Dienste auf, für die `mayLoad` gilt: aktuelle Einwilligung für genau diesen Dienst, eingetragene ID, keine Token-Seite.
- Skripte lädt `loaders.ts` erst nach Einwilligung dynamisch: Meta `fbevents.js` (mit `autoConfig` aus und ohne automatische PageViews bei Client-Navigation), Google `gtag/js` mit eigener Ebene `pvGoogleLayer` und Consent Mode v2 (Standard alles `denied`, danach nur `ad_storage`, `ad_user_data`, `ad_personalization` auf `granted`, `analytics_storage` bleibt `denied`), TikTok `events.js`.
- Events vor der Einwilligung werden je Seite gepuffert. Willigt jemand auf derselben Seite ein, bekommen die neu geladenen Dienste `page_view` und die Seitenevents nachgereicht.
- Token-Seiten ohne Dienste (`src/lib/tracking/paths.ts`): `/checkout/danke`, `/newsletter`, `/account`, `/auth`, `/admin`, `/api`, `/abo`, `/bewertung`. Die Pixel lesen die Seitenadresse selbst aus; der Token der Bestellbestätigung würde sonst bei den Anbietern landen. `page_location` enthält nur Kampagnenparameter (`utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`), keine Suchbegriffe, E-Mail-Adressen oder Tokens.
- Events aus Server Actions: `emitTrackingEvent` legt sie nur mit Marketing-Einwilligung in `pv_track_q` (höchstens drei Events, unter 2,4 KB). Der Browser liest den Cookie beim nächsten Seitenwechsel oder kurz nach einem Formular-Submit, sendet einmal und löscht ihn.

## Serverseite

- `emitTrackingEvent` (`src/lib/tracking/events.ts`, API wie vorher) ruft `recordServerEvent` und `queueBrowserEvent` auf und wirft nie.
- `recordServerEvent` (`src/lib/tracking/server.ts`) schreibt idempotent in `tracking_events` (Migration `20261017108000_tracking_events.sql`): Event, `event_id`, Wert in Cent, Bestellnummer als HMAC (`APP_TOKEN_SECRET`), Einwilligungsstand (`granted`, `denied`, `unknown`), eingewilligte Dienste und Textversion, `sent_to` leer.
- `purchase` kommt aus dem Webhook-Job ohne Browser-Anfrage; der Einwilligungsstand steht dort deshalb auf `unknown`.

## IDs eintragen

1. Backoffice, Einstellungen, Tracking (Paket CRM/Backoffice). Gespeichert wird in `shop_settings`, Schlüssel `tracking`, öffentlich lesbar:
   `meta_enabled`, `meta_pixel_id` (nur Ziffern), `google_enabled`, `google_ads_conversion_id` oder `google_tag_id` (Format `AW-…`), `google_ads_labels` (zum Beispiel `{"purchase": "AbCdEf"}`), `tiktok_enabled`, `tiktok_pixel_id`. Eine GA4-ID (`G-…`) wird nicht geladen, solange die Kategorie Statistik keinen Anbieter hat.
2. Rückfall ohne Backoffice: `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_TAG_ID`, `NEXT_PUBLIC_TIKTOK_PIXEL_ID` (Netlify-Umgebung). Ein Schalter "aus" im Backoffice gewinnt.
3. Jede ID wird gegen ein strenges Format geprüft (`ID_PATTERNS` in `src/lib/tracking/config.ts`), weil sie in eine Skript-URL kommt.
4. Das Layout ist statisch. Nach dem Speichern im Backoffice muss die Speichern-Aktion `revalidatePath("/", "layout")` aufrufen, sonst gelten die neuen IDs erst nach der nächsten Revalidierung (spätestens nach einer Stunde) oder dem nächsten Deploy.
5. Danach `CONSENT_VERSION` erhöhen, wenn ein Dienst neu dazukommt, damit alle Besucher neu gefragt werden.

## Was noch fehlt

- **Conversions API (Meta), Events API (TikTok), GA4 Measurement Protocol:** Sender als Netlify Function oder Job, der `tracking_events` mit `consent_state = 'granted'` liest, an die Anbieter sendet und `sent_to` füllt. Braucht `META_CAPI_ACCESS_TOKEN`, `TIKTOK_EVENTS_ACCESS_TOKEN`, `GA4_API_SECRET` und die Freigabe des Auftraggebers.
- **Einwilligung an der Bestellung:** Damit `purchase` aus dem Webhook einen Einwilligungsstand hat, muss der Checkout den Stand aus `pv_consent` beim Schritt Zahlung an der Checkout-Session speichern (Spalte oder `legal_versions`), dazu UTM-Parameter und Klick-IDs (Briefing 6). Gemeinsame Dateien des Checkouts, nicht in diesem Paket.
- **Gehashte Kundendaten** (Advanced Matching, Enhanced Conversions): erst mit Freigabe und nur serverseitig.
- **Browser-Purchase:** bewusst nicht, weil die Bestätigungsseite einen Zugangs-Token in der Adresse trägt. Wenn gewünscht: Bestätigungsseite auf eine Adresse ohne Token umstellen (Token im httpOnly-Cookie), dann kann der Browser `purchase` mit derselben `event_id` senden.
- **Server-Side-Tagging** (eigener Tagging-Server, First-Party-Domain): nicht vorgesehen; nur bei Bedarf und mit eigener Datenschutzprüfung.
- **Produktfeeds** (Google Merchant Center, Meta-Katalog, TikTok-Katalog) mit Grundpreis, GTIN und Verfügbarkeit.
- Speicherdauern der Anbieter-Cookies in `src/lib/tracking/vendors.ts` vor dem Go-live mit den aktuellen Anbieterangaben und der Datenschutzerklärung abgleichen.

## Tests

`pnpm test` mit `src/lib/tracking/consent.test.ts` (Parser, Serialisierung, Entscheidung, darf laden), `adapters.test.ts` (Mapping je Anbieter), `tracking-helpers.test.ts` (IDs aus shop_settings, Adressbereinigung, Warteschlange).
