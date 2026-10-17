# Zahlarten-Zeichen im Footer

Stand: 17.10.2026. Wunsch des Auftraggebers: "Bitte hole dir die offiziellen Logos / Zeichen für die Zahlungsmethoden unten für den Footer." Bisher zeigte der Footer Text-Badges.

## Grundsätze

- Nur Originaldateien der Markeninhaber oder eindeutig lizenzierte Dateien. Nichts nachgezeichnet, keine inoffiziellen Icon-Sets, keine Bitmaps.
- Die Grafik bleibt unverändert: keine Umfärbung, keine Verzerrung, kein Beschnitt der Marke. Entfernt wurden nur Metadaten (XML-Kopf, Kommentare, `id`, `title`, `role`, `aria-*`, Inline-`style` mit doppelter Farbangabe), Weißraum im Code und bei Google Pay der leere Rand außerhalb der Marke (nur `viewBox`).
- Ausgeliefert wird lokal aus `public/images/payments/`, nie von fremden Servern. Keine Skripte, keine externen Referenzen, jede Datei hat eine `viewBox`.
- Ein Zeichen wird nur gezeigt, solange die Zahlart tatsächlich angeboten wird. Fällt eine Zahlart weg, fliegt auch ihr Zeichen aus `PAYMENT_METHODS` in `src/components/layout/social.ts`.
- Die Markenrechte bleiben bei den Inhabern. Eine Lizenz für die Datei (zum Beispiel MIT) ersetzt nicht die Markenregeln; die Nutzung als Akzeptanzzeichen eines Händlers, der die Zahlart anbietet, ist der vorgesehene Zweck aller Zeichen hier.

## Beschaffung

Versuchsreihenfolge laut Auftrag: (a) offizielle Brand-Center ohne Login, (b) MIT-lizenziertes Repository `activemerchant/payment_icons`, (c) Shopify-Snapshot unter `assets/source/`.

| Marke            | Brand-Center ohne Login per curl                                                                     | Ergebnis |
| ---------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| Visa             | `visa.com/en_us/visa-brand-elements.html` antwortet 404, Brand-Assets nur mit Login                  | (b)      |
| Mastercard       | `brand.mastercard.com`, `mastercard.com/brandcenter/...` antworten 403                               | (b)      |
| Maestro          | gehört zu Mastercard, siehe oben                                                                     | (b)      |
| American Express | Merchant-Seite erreichbar, Logo-Download nur mit Händler-Login                                       | (b)      |
| Apple Pay        | `developer.apple.com/apple-pay/marketing/` mit Download `Apple-Pay-Mark.zip`                         | (a)      |
| Google Pay       | `developers.google.com/pay/api/web/guides/brand-guidelines` mit Download `Google-Pay-Acceptance.zip` | (a)      |
| PayPal           | offizielles Asset-CDN `paypalobjects.com`                                                            | (a)      |
| Klarna           | offizielles Badge auf dem Klarna-CDN `x.klarnacdn.net`                                               | (a)      |

(c) Im Shopify-Snapshot unter `assets/source/` liegen keine Zahlarten-SVGs. Der bisherige Shop rendert seine Zahlarten-Icons inline im Footer; ein Abgleich der Live-Seite www.provibe-drinks.de vom 17.10.2026 zeigt, dass die Pfaddaten für Visa, Mastercard, Maestro, American Express, Apple Pay, Google Pay, PayPal und Klarna exakt mit `activemerchant/payment_icons` übereinstimmen. Der Footer zeigt Visa, Mastercard, Maestro und American Express also in genau der Form, die Kundinnen aus dem alten Shop kennen.

## Je Zeichen

| Datei                             | Marke            | Quelle                                                                                                                                  | Lizenz und Nutzungsbedingung                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visa.svg` (38 × 24)              | Visa             | https://raw.githubusercontent.com/activemerchant/payment_icons/master/app/assets/images/payment_icons/visa.svg                          | Datei: MIT, Copyright 2015 Shopify Inc (`MIT-LICENSE` im Repository, `s.license = 'MIT'` im Gemspec). Marke: Visa Inc.; Akzeptanzzeichen für Händler, die Visa annehmen, unverändert verwenden.                                                                                                                                                                                                          |
| `mastercard.svg` (38 × 24)        | Mastercard       | wie oben, Datei `master.svg`                                                                                                            | Datei: MIT, Shopify Inc. Marke: Mastercard International; Akzeptanzzeichen nur bei Annahme von Mastercard, Kreise und Farben unverändert.                                                                                                                                                                                                                                                                |
| `maestro.svg` (38 × 24)           | Maestro          | wie oben, Datei `maestro.svg`                                                                                                           | Datei: MIT, Shopify Inc. Marke: Mastercard International; nur zeigen, solange Maestro tatsächlich angenommen wird (siehe Offenes).                                                                                                                                                                                                                                                                       |
| `american-express.svg` (38 × 24)  | American Express | wie oben, Datei `american_express.svg`                                                                                                  | Datei: MIT, Shopify Inc. Marke: American Express; Blue-Box-Zeichen unverändert, nur bei Annahme von American Express.                                                                                                                                                                                                                                                                                    |
| `apple-pay.svg` (165,52 × 105,97) | Apple Pay        | https://developer.apple.com/apple-pay/marketing/Apple-Pay-Mark.zip, Datei `Apple Pay Mark/SVG/Apple_Pay_Mark_RGB_041619.svg`            | Apple Pay Marketing Guidelines: Das Apple Pay Mark darf nur von Händlern genutzt werden, die Apple Pay anbieten, nur die gelieferte Grafik, nicht verändern, nicht animieren, Schutzraum um das Zeichen, nie kleiner als die in den Richtlinien genannte Mindestgröße. Die Datei von activemerchant ist dieselbe Grafik; verwendet wird die Originaldatei von Apple.                                     |
| `google-pay.svg` (757 × 404)      | Google Pay       | https://developers.google.com/static/pay/api/download-assets/Google-Pay-Acceptance.zip, Datei `Google Pay Mark/google-pay-mark_800.svg` | Google Pay Brand Guidelines: Acceptance Mark für Händler, die Google Pay anbieten, unverändert verwenden, Schutzraum einhalten. Geändert wurde nur die `viewBox` (vorher `0 0 1094 742`, jetzt `168 168 757 404`), damit der leere Rand der Datei nicht die Höhe frisst; die Marke selbst samt Rahmen ist vollständig. Den Schutzraum stellen Plättchen-Innenabstand und Abstand zwischen den Plättchen. |
| `paypal.svg` (170 × 48)           | PayPal           | https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-color.svg                                                                      | PayPal-Markenrichtlinien: Logo nur bei Annahme von PayPal, Farben und Proportionen unverändert, Schutzraum. Reine Wortmarke ohne eigene Fläche, deshalb im Plättchen kleiner gesetzt (15 px mobil, 18 px Desktop) mit seitlichem Innenabstand.                                                                                                                                                           |
| `klarna.svg` (1448 × 609)         | Klarna           | https://x.klarnacdn.net/payment-method/assets/badges/generic/klarna.svg                                                                 | Klarna-Markenrichtlinien: offizielles Payment Badge für Händler, die Klarna anbieten, Pink und Schwarz unverändert, nicht verzerren.                                                                                                                                                                                                                                                                     |

Dateigrößen nach der Bereinigung: zusammen rund 20 KB (Apple Pay 5,8 KB, alle anderen unter 3,5 KB).

## Darstellung im Footer

- `src/components/layout/Footer.tsx`, Abschnitt "Zahlarten" mit sichtbarer Überschrift wie bisher.
- Jedes Zeichen auf einem weißen, abgerundeten Plättchen mit dezentem Rahmen (Block `/* Zahlarten */` am Ende von `src/app/globals.css`), damit die Markenfarben auf Wine lesbar bleiben. Kontrast Weiß auf Wine (#6b1d49) rund 11 : 1.
- Einheitliche Höhe: Zeichen 24 px mobil, 28 px ab 861 px; Plättchen 32 px beziehungsweise 36 px. Die Breite folgt dem Seitenverhältnis der Datei (`width: auto`), dadurch keine Verzerrung. `next/image` mit `unoptimized` und festen `width`/`height`-Attributen, kein Layout-Shift.
- alt-Text ist der Markenname. Keine Links, keine Fokusziele.

## Weitere Stellen

- Checkout (`src/components/checkout/PaymentForm.tsx`): Die Zahlarten sind dort Formularoptionen (Radio-Karten mit Titel und Untertitel aus `src/lib/checkout/types.ts`). Laut Auftrag nicht umgebaut.
- `src/components/checkout/StripePaymentElement.tsx`: Im Live-Modus zeigt Stripe die Zeichen im Payment Element selbst.
- Sonst nutzt nur der Footer `PAYMENT_METHODS` aus `social.ts`.

## Offen

- Maestro: Mastercard stellt Maestro in mehreren EU-Ländern schrittweise ein. Prüfen, ob Maestro über das Stripe-Konto des Shops noch angenommen wird; wenn nicht, Zeichen entfernen.
- Bei Abo-Bestellungen gibt es kein Klarna (H25). Das Zeichen im Footer bleibt, weil Klarna für Einzelbestellungen angeboten wird.
- Die Mindestgrößen aus den Richtlinien von Apple und Google beziehen sich auf die jeweiligen PDFs, die hinter den Download-Seiten liegen; vor dem Go-live einmal gegen die aktuelle Fassung prüfen.
