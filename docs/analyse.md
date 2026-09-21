# Analyse des bestehenden Shopify-Shops (Phase 1)

Stand: 21.09.2026. Quelle: https://www.provibe-drinks.de/ (Crawl per `curl`, Shopify-Endpunkte `products.json`, `collections.json`, `cart.js`, alle Sitemaps). Rohdaten liegen unter `assets/source/data/shopify-snapshot/`, die extrahierten Seitentexte unter `docs/quelltexte/`, alle Medien unter `assets/source/`.

## 1. Plattform und Technik

| Punkt | Befund |
|---|---|
| Shop-ID / Domain | Shopify Shop 92984115527, `frtb1k-rh.myshopify.com`, Custom Domain `www.provibe-drinks.de` (Apex und http leiten per 301 auf `https://www.` um) |
| Theme | Dawn 15.4.0 ("Kopie von Kopie von Dawn"), stark angepasst: Startseite, Shop-Seite, Kollektionen, PDP und Warenkorb sind komplett als `custom_liquid`-Sektionen mit eigenem Inline-CSS gebaut (Präfixe `pv-`, `pvpdp-`, `pvbs-`, `pvcart-`) |
| Sprache | nur Deutsch (`lang="de"`), keine `hreflang`, keine Märkte |
| Währung | EUR, Land DE |
| Checkout | Shopify Checkout, `/checkout` leitet auf `shop.app` (Shop Pay) um |
| Kundenkonto | Shopify "New Customer Accounts" (passwortlos per Code), `/account*` leitet auf `shopify.com/92984115527/account` um |
| Suche | Dawn Predictive Search, Ergebnisse werden nur per JavaScript gerendert, die Server-Antwort von `/search?q=peach` enthält keine Treffer im HTML |
| Blog | `/blogs/news` existiert in der Sitemap, hat aber keinen einzigen Artikel |
| DNS | `www` CNAME auf `shops.myshopify.com`, Apex auf Shopify-IPv6 (`2620:127:f00f:5::`) |
| Agent-Schnittstellen | `agents.md`, `/.well-known/ucp`, UCP/MCP-Endpunkt (Shopify-Standard, entfällt) |

### Eingebundene Skripte und Apps

| Skript / App | Zweck | Konsequenz für den Nachbau |
|---|---|---|
| Shopify Trekkie, Web Pixels Manager (`shopify-app-pixel`, `shopify-custom-pixel`) | Shopify-Analytics plus ein **Custom Pixel unbekannten Inhalts** (Konfiguration ist nicht im HTML sichtbar) | Inhalt des Custom Pixels erfragen (Shopify Admin, Einstellungen, Kundenereignisse) |
| `facebookCapiEnabled: false` | Meta Conversions API ist nicht aktiv | Neu aufbauen (Abschnitt 6 im Briefing) |
| Keine GA4-, GTM-, Meta-, TikTok-IDs im HTML | derzeit kein sichtbares Drittanbieter-Tracking im Quelltext | IDs erfragen, sonst neu anlegen |
| Google Fonts vom CDN (`fonts.googleapis.com`: Jost, Outfit, Source Serif 4) | Schriften | DSGVO-Risiko heute, im Nachbau selbst hosten |
| Shopify Fonts CDN (Assistant, DM Serif Text) | Dawn-Standardschriften | entfällt, Jost reicht |
| `shop-js` (Shop Follow Button, Cart Sync), `portable-wallets`, `shopify_pay/storefront` | Shop Pay, Beschleunigter Checkout | entfällt, Ersatz: Stripe Express Checkout Element |
| Shopify EU Widerrufsbutton App (apps.shopify.com/eu-widerrufsbutton) | elektronische Widerrufsfunktion auf `/pages/widerruf-formular` und `/pages/widerrufsbutton` (Formular wird per App-Block geladen) | eigenes Widerrufsformular mit Eingangsbestätigung bauen |
| Shopify Contact Form (`/contact#contact_form`) | Kontakt- und Partnerformular (Felder: name, email, phone, body) | eigene Netlify Function mit Honeypot und Rate Limit |
| Shopify Newsletter (`/contact#ContactFooter`, `contact[tags]=newsletter`) | Footer-Newsletter, Single Opt-in ohne DOI-Nachweis im HTML erkennbar | Double Opt-in mit Resend |
| Kein Cookie-Banner einer Drittanbieter-App im HTML | nur Shopify Customer-Privacy-API vorhanden | eigenes Consent-Banner (TDDDG) |
| Keine Bewertungs-App, keine Pop-ups, kein Chat | | Bewertungsmodul laut Briefing neu |
| `g-recaptcha` nur als CSS-Klasse in Dawn | kein aktives reCAPTCHA-Widget gefunden, Shopify schützt Formulare serverseitig | Honeypot plus Rate Limit |

## 2. URL-Inventar

Alle URLs aus Sitemap, Navigation, Footer und Verlinkung. Status = Antwort des aktuellen Shops. "Ziel" = Vorschlag für den Nachbau, Redirects landen in `docs/redirects.md` und `netlify.toml`.

### Startseite, Shop, Kollektionen

| URL | Status | Title | H1 | Meta Description | Ziel |
|---|---|---|---|---|---|
| `/` | 200 | provibe - Eistee mit Protein – Provibe | Protein, das in jede Tasche passt. | fehlt | 1:1 |
| `/pages/shop` | 200 | shop – Provibe | get the vibe | fehlt | 1:1 |
| `/collections/all` | 200 | Produkte – Provibe | get the vibe | fehlt | 1:1 (alle 9 Produkte) |
| `/collections/alle-produkte` | 200 | Produkte – Provibe | get the vibe | fehlt | 1:1 (7 Produkte, ohne Shirt und Cup) |
| `/collections/eistee` | 200 | Eistee – Provibe | get the vibe | fehlt | 1:1 (4 Produkte) |
| `/collections/aktion` | 200 | Founder Bundles – Provibe | get the vibe | fehlt | 1:1 (3 Bundles) |
| `/collections` | 200 | Kollektionen – Provibe | Collections (englisch, Dawn-Standard) | fehlt | 1:1, deutsch |
| `/search`, `/search?q=…` | 200 | Suchen – Provibe | fehlt | fehlt | eigene, servergerenderte Suche |
| `/cart` | 200 | Dein Warenkorb – Provibe | Dein Warenkorb (0) | fehlt | 1:1 |
| `/blogs/news` | 200 | News – Provibe | News | fehlt | Route behalten, leer, `noindex` bis zum ersten Artikel |

### Produkte

| URL | Status | Title | Ziel |
|---|---|---|---|
| `/products/wildberry` | 200 | Wildberry Eistee – Provibe | 1:1 |
| `/products/peach` | 200 | Peach Eistee – Provibe | 1:1 |
| `/products/raspberry-lime` | 200 | Raspberry-Lime Eistee – Provibe | 1:1 |
| `/products/provibe-eistee-mixed` | 200 | provibe Eistee mixed – Provibe | 1:1 |
| `/products/founder-bundle-i` | 200 | Founder Bundle l – Provibe | 1:1 |
| `/products/founder-bundle-ii` | 200 | Founder Bundle ll – Provibe | 1:1 |
| `/products/founder-bundle-iii-1` | 200 | Founder Bundle lll – Provibe | 1:1 (Handle mit `-1` beibehalten) |
| `/products/founder-bundle-iii` | 404 | | 301 auf `/products/founder-bundle-iii-1` (naheliegender Tippfehler) |
| `/products/provibe-shirt` | 200 | provibe shirt – Provibe | 1:1 |
| `/products/provibe-clear-cup` | 200 | provibe clear cup – Provibe | 1:1 |
| `/products/{handle}.json` | 200 | Shopify-API | entfällt |

### Inhaltsseiten

| URL | Status | Title | H1 | Inhalt | Ziel |
|---|---|---|---|---|---|
| `/pages/uber-uns` | 200 | Über uns – Provibe | fehlt | drei Blöcke (Idee, Entwicklung, Vision), drei Bilder (eins davon HEIC) | 1:1, H1 ergänzen |
| `/pages/partner` | 200 | Partner – Provibe | Provibe für dein Geschäft oder Gym | B2B-Text, Vorteile, Formular, partner@provibe-drinks.de | 1:1, Lead-Liste |
| `/pages/contact` | 200 | Kontakt – Provibe | Wir sind für dich da | Formular, hello@provibe-drinks.de, "innerhalb von 24 Stunden" | 1:1 |
| `/pages/messe` | 200 | Messe – Provibe | Eistee mit Protein. Funktion, die sich wie Sommer anfühlt. | Investoren-Pitch (Produkt, Problem, Zielgruppe, Pitch Deck, Termin) | 1:1, `noindex` empfohlen |
| `/pages/qr-code-page-investoren` | 200 | Qr code page Investoren – Provibe | identisch mit `/pages/messe` | Duplikat | 301 auf `/pages/messe` (Frage F12) |
| `/pages/qrcode` | 200 | qrcode 1 – Provibe | get the vibe | identisch mit `/pages/shop` | 301 auf `/pages/shop`, QR-Codes auf Druckmaterial funktionieren weiter |
| `/pages/provibe-paket` | 200 | provibe Paket – Provibe | fehlt | nur Template-Inhalt ("Leichte Erfrischung" usw.), kein eigener Text | 301, Ziel klären (Frage F12) |
| `/pages/provibe-founder-paket` | 200 | provibe Founder Paket – Provibe | fehlt | identisch mit `/pages/provibe-paket` | 301, Ziel klären |
| `/pages/datenschutzerklarung` | 200 | Datenschutzerklärung – Provibe | fehlt | **enthält keine Datenschutzerklärung**, nur denselben Template-Inhalt | 301 auf `/policies/privacy-policy` |

### Rechtstexte

| URL | Status | Title | Inhalt | Ziel |
|---|---|---|---|---|
| `/pages/impressum` | 200 | Impressum – Provibe | CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, GF Celine Grimm, USt-IdNr. DE457662597, HRB 41818 Augsburg, BLM als Aufsicht, VSBG-Hinweis (nicht bereit) | 1:1, LUCID-Feld ergänzen |
| `/pages/allgemeine-geschaftsbedingungen` | 200 | Allgemeine Geschäftsbedingungen – Provibe | §1 bis §6 plus Kundeninformationen (Händlerbund-Muster), enthält §3 Abo-Kündigung, nennt PayPal, Amazon Pay, Sofort | 1:1, Bestellablauf und Zahlarten anpassen (`docs/rechtstexte-aenderungen.md`) |
| `/pages/ruckgabe-und-wiederrufsbelehrung` | 200 | Rückgabe- und Widerrufsbelehrung – Provibe | Widerrufsbelehrung, Ausschlussgründe (verderbliche Waren, versiegelte Hygieneartikel), Muster-Widerrufsformular, Kontakt support@provibe-drinks.de | 1:1 |
| `/pages/versand` | 200 | Versand – Provibe | nur Deutschland, 4,90 € pauschal, frei ab 50 €, 3 bis 5 Werktage, Pre-Sale 6 bis 8 Wochen, Zahlarten Kreditkarte, PayPal, Banküberweisung | 1:1, Zahlarten anpassen |
| `/pages/widerruf-formular` | 200 | Widerruf – Provibe | Shopify-App-Block "Widerruf erklären" | eigenes Formular |
| `/pages/widerrufsbutton` | 200 | widerrufsbutton – Provibe | identisch | 301 auf `/pages/widerruf-formular` |
| `/policies/privacy-policy` | 200 | Datenschutzerklärung – Provibe | Shopify-Standardtext (13 Abschnitte, "Beziehung mit Shopify") | 1:1 übernehmen, Shopify-Passagen ersetzen |
| `/policies/terms-of-service`, `/policies/refund-policy`, `/policies/shipping-policy`, `/policies/legal-notice`, `/policies/contact-information` | 404 | nicht gepflegt | 301 auf die jeweiligen `/pages/*` (kostet nichts, fängt alte Links ab) |

### Externe Ziele

- Login: `https://www.provibe-drinks.de/customer_authentication/redirect?locale=de&region_country=DE` (Header "Einloggen") → neu `/account/login`
- Instagram: `https://www.instagram.com/provibe.de` (mit `igsh`- und `utm_source=qr`-Parametern)
- TikTok: `https://www.tiktok.com/@provibe.de`

## 3. SEO-Zustand

- Title-Muster: `{Seitentitel} – Provibe` (mit Zeilenumbruch im Title-Tag, Shopify-Artefakt).
- Meta Descriptions fehlen auf allen Seiten, Shopify fällt auf den Seitenanfang zurück (nur bei Produkten und Rechtstexten sinnvoll).
- Canonical: überall korrekt auf sich selbst. `robots`-Meta fehlt überall.
- OG-Tags vorhanden, OG-Image für alle Nicht-Produktseiten ist ein Screenshot mit 1607 × 602 px (`Screenshot_2026-05-26_17.03.18_-_bearbeitet.png`). Twitter Card `summary_large_image`.
- JSON-LD: nur `Organization` (mit leeren `sameAs`-Einträgen) und `WebSite` mit `SearchAction` auf der Startseite. **Kein `Product`, kein `Offer`, kein `BreadcrumbList`** auf den PDPs.
- H1: fehlt auf Über uns, Suche, Widerruf-Formular, Datenschutz; doppelt auf Founder Bundle II und III (Custom-Sektion plus Dawn-Sektion); "get the vibe" als identische H1 auf Shop und allen Kollektionen.
- Sitemap: Shopify-Index mit vier Teil-Sitemaps plus `sitemap_agentic_discovery.xml`. Bilder sind in der Produkt-Sitemap enthalten.
- `robots.txt`: Shopify-Standard (sperrt `/cart`, `/checkout`, `/account`, `/admin`, `/search` nicht gesperrt).
- Kein Schema für FAQ, keine Bewertungen.

## 4. Funktionsliste (Ist)

### Header und globale Elemente

- Announcement-Bar mit zwei rotierenden Meldungen: "Versandkostenfrei ab 50 €" und "10% Rabatt auf deine Bestellung mit dem Code PRESALE10".
- Header: Logo `provibe-logo-wine.png`, Navigation Shop, Über uns, Partner, Kontakt, Icons für Suche, Login, Warenkorb. Mobile: Menü-Drawer mit denselben Links plus Instagram und TikTok.
- Footer: Quick-Links (Impressum, Datenschutzerklärung, AGB, Widerruf, Versand, Vertrag widerrufen), Newsletter-Feld "Zum Newsletter. Versprochen ohne Spam." (nur E-Mail), Social-Icons Instagram und TikTok, Zahlarten-Icons (American Express, Apple Pay, Google Pay, Klarna, Maestro, Mastercard, PayPal, Shop Pay, Union Pay, Visa), "© 2026, Provibe", Claim "Powered by Protein".
- Suche als Modal mit Predictive Search.

### Startseite (sechs Custom-Sektionen)

1. Hero: Eyebrow "Eistee mit Protein", H1 "Protein, das in jede Tasche passt.", Text, drei Badges (15 g Protein, Ohne Zucker, Eiskalt & erfrischend), CTA "Jetzt entdecken" → `/collections/all`. Hintergrundbild `Element_9_10x…png`.
2. Bestseller-Modul: "Unser Bestseller" provibe Eistee mixed, Grundpreis "€8,03 / Liter", Preis, Packgrößen-Auswahl (9 bis 48), "In den Warenkorb", darunter "oder sofort bezahlen" mit Shopify Accelerated Checkout (Shop Pay), Link "Alle Details ansehen".
3. Sorten: "Such dir deinen Vibe.", drei Karten (Wildberry, Raspberry Lime, Peach) mit Dosenbild, "15 g Protein", "Eistee · 0,33 l", Geschmacksnoten, **Preis je Dose 2,65 €** (Preis ohne Pfand), Link "Alle ansehen".
4. Story-Block: Eyebrow "Protein for your purse", H2 "Schluss mit dem pelzigen Proteingefühl.", Text, CTA.
5. Founder Bundles: drei Karten mit Streichpreis (63,90 → 57,40; 35,80; 49,90 → 45,80), Badge "Limitiertes Set".
6. Leere sechste Sektion (nur Marker).

### Produktdetailseite (Custom-Template `#pvpdp`)

- Breadcrumb-Tabs All, Eistee, Aktionen. Galerie im "Rhode-Stil" (Thumbnails links, Hauptbild 4:5, sticky).
- Titel (lowercase per CSS), Untertitel "Eistee mit 15 g Protein", Grundpreis "8,03 € / Liter" **statisch**, Beschreibung, Hinweis "Pfand bereits im Preis inkl. (0,25€ pro Dose)".
- Packgröße als `<select>` mit Preis, Streichpreis und Preis je Dose (9 Dosen 26,10 € · 2,90 €/Dose bis 48 Dosen 132,00 € · 2,75 €/Dose).
- Button "In den Warenkorb", darunter "Lieferzeit aktuell 6–8 Wochen" und "inkl. Pfand (0,25 € pro Dose)".
- Akkordeons: Inhaltsstoffe (alle drei Sorten), Nährwertangaben (alle drei Sorten, pro 100 ml), Allergene (Milch, einschließlich Laktose).
- Kollektions-Kacheln, Story-Sektion "Unsere Geschichte" mit Gründerinnen-Zitat und Video (`2717ef35153f40e5bbc51fa2f93a9008.mov`, 37 MB, mit Mute-Button).
- Bundle-Template (`#pvtee`): Größenwahl S, M, L für das Shirt, Akkordeons Größe & Passform, Material & Pflege, Versand & Rückgabe. Enthält den Platzhalter "Maßtabelle hier ergänzen".
- **Template-Fehler im Ist:** Shirt und Clear Cup zeigen "Eistee mit 15 g Protein", "8,03 € / Liter", "inkl. Pfand" und die Eistee-Zutaten. Founder Bundle I zeigt ebenfalls Eistee-Zutaten. Das übernehmen wir nicht.

### Warenkorb (`/cart`, Custom-Template `#pvcart`)

- Zeilen mit Bild, Titel, Variante, Mengensteuerung (−/+), Zeilenpreis, "Entfernen", "← Weiter einkaufen".
- Übersicht: Zwischensumme, "Versand wird beim Checkout berechnet", Gesamt, "inkl. MwSt. · kostenloser Versand ab 50 €", "Lieferzeit aktuell 6–8 Wochen", "inkl. Pfand (0,25 € pro Dose)", Button "Zur Kasse", Trust-Badges (15 g Protein, Ohne Zucker, Made in Germany).
- Kein Rabattcode-Feld, keine Fortschrittsanzeige zur Versandkostenfreigrenze, kein Bestellhinweis-Feld, kein Drawer (Dawn-Cart-Notification-Skript ist geladen, das Custom-Formular nutzt aber Redirect auf `/cart`).
- `cart.js` liefert `unit_price` 290 Cent je "item" (Shopify-Grundpreis auf Stückbasis, nicht auf Liter).

### Weitere Seiten

- Shop-Seite und Kollektionen: Hero "get the vibe", Filter-Tabs All, Eistee, Aktionen, Produktgrid mit "In den Warenkorb" direkt auf der Karte (fügt die erste Variante hinzu), Kollektions-Kacheln.
- 404: "Seite nicht gefunden", "Weiter shoppen" → `/collections/all`.
- Kontakt und Partner: Formular (Name, E-Mail, Telefon, Nachricht), Senden.

### Checkout (Shopify, nicht einsehbar)

Der Checkout liegt bei Shopify und leitet auf shop.app um. Zahlarten laut Footer-Icons: Karten (Visa, Mastercard, Maestro, Amex, UnionPay), Apple Pay, Google Pay, PayPal, Klarna, Shop Pay. Laut Versandseite: Kreditkarte, PayPal, Banküberweisung. Rabattcode PRESALE10 (10 %) wird im Checkout eingelöst.

## 5. Produktdaten (aus `products.json`)

| Produkt | Handle | Varianten | Preise (compare_at) | SKU | Gewicht | Bilder |
|---|---|---|---|---|---|---|
| Wildberry Eistee | wildberry | Menge 9/12/18/24/36/48 | 26,10 / 34,60 (34,80) / 51,50 (52,20) / 67,90 (69,60) / 100,90 (104,40) / 132,00 (139,20) | WILDBERRY-1 bis -6 | 0 g | 4 |
| Peach Eistee | peach | wie oben | identisch | nur "PEACH" auf 9er | 0 g | 4 |
| Raspberry-Lime Eistee | raspberry-lime | wie oben | identisch, außer 48er compare 137,70 (Datenfehler) | keine | 0 g | 3 |
| provibe Eistee mixed | provibe-eistee-mixed | wie oben | identisch | keine | 0 g | 4 |
| Founder Bundle I | founder-bundle-i | Default | 35,80 | keine | 0 g | 2 |
| Founder Bundle II | founder-bundle-ii | Shirt-Größe S/M/L | 45,80 (49,90 nur bei M und L) | keine | 0 g | 5 |
| Founder Bundle III | founder-bundle-iii-1 | Shirt-Größe S/M/L | 57,40 (63,90 nur bei M und L) | keine | 0 g | 4 |
| provibe shirt | provibe-shirt | Größe S/M/L | 29,90 | keine | 0 g | 1 |
| provibe clear cup | provibe-clear-cup | Default | 19,90 | keine | 0 g | 1 |

Beobachtungen:

- Vendor überall "Provibe", `product_type` und `tags` leer, keine Alt-Texte, keine GTIN/EAN, keine Gewichte, Bestände nicht öffentlich einsehbar.
- Streichpreise der Packgrößen entsprechen exakt `Anzahl × 2,90 €` (Preis je Dose im 9er-Pack), sind also ein Mengenrabatt-Vergleich und kein früherer Verkaufspreis.
- Bundles sind einfache Produkte ohne Komponenten-Verknüpfung. Rechnerisch: Bundle I = 6 Dosen (17,40) + Cup (19,90) = 37,30 → 35,80. Bundle II = 6 Dosen + Shirt (29,90) = 47,30 → 45,80 (compare 49,90). Bundle III = 6 Dosen + Cup + Shirt = 67,20 → 57,40 (compare 63,90). Die Streichpreise entsprechen also weder der Summe der Einzelpreise noch einem dokumentierten früheren Preis.
- Mixed-Pack: "Jede Sorte zu gleichen Teilen" (9 = 3/3/3, 12 = 4/4/4, 18 = 6/6/6, 24 = 8/8/8, 36 = 12/12/12, 48 = 16/16/16).
- Grundpreis: 26,10 € abzüglich 9 × 0,25 € Pfand = 23,85 € auf 2,97 l = 8,03 €/l. Der Wert stimmt nur für den 9er-Pack und wird auf allen Größen und sogar auf Shirt und Cup statisch angezeigt.
- Titel "Founder Bundle l / ll / lll" verwenden kleine L statt römischer Ziffern.

### LMIV-Angaben laut PDP

- Bezeichnung: Eistee mit Protein (Sorten Wildberry, Raspberry-Lime, Peach), 0,33 l je Dose.
- Zutaten Wildberry: Wasser, Beta-Lactoglobulin aus Kuhmilch (Molkenprotein), 4,4 % schwarzer Johannisbeersaft aus Konzentrat, 1,6 % Limettensaft aus Konzentrat, natürliche Aromen, färbendes Lebensmittel (Karotte, Heidelbeere), Süßungsmittel (Sucralose).
- Zutaten Raspberry-Lime: Wasser, Beta-Lactoglobulin aus Kuhmilch, 3,8 % Himbeersaft aus Konzentrat, 3,5 % Limettensaft aus Konzentrat, natürliche Aromen, färbendes Lebensmittel (Süßkartoffel, Rettich, Apfel), Süßungsmittel (Sucralose).
- Zutaten Peach: Wasser, Beta-Lactoglobulin aus Kuhmilch, 3 % Pfirsichsaft aus Konzentrat, 1,5 % Limettensaft aus Konzentrat, natürliche Aromen, färbendes Lebensmittel (Karotte, Saflor), Süßungsmittel (Sucralose).
- Nährwerte je 100 ml: Wildberry 91 kJ / 22 kcal, Raspberry-Lime 86 kJ / 20 kcal, Peach 89 kJ / 21 kcal. Alle: Fett < 0,5 g, davon gesättigt < 0,1 g, Kohlenhydrate < 0,5 g, davon Zucker < 0,5 g, Ballaststoffe < 0,5 g, Eiweiß 4,5 g, Salz < 0,01 g.
- Allergene: Milch und daraus gewonnene Erzeugnisse (einschließlich Laktose).
- **Fehlt auf der PDP:** verantwortlicher Lebensmittelunternehmer mit Anschrift, Aufbewahrungshinweis, Nettofüllmenge als Pflichtangabe am Preis, Herkunft ("Made in Germany" nur als Badge).
- **Widerspruch:** Messe-Seite wirbt mit "laktosefrei" und "100 % natürlich", Allergenhinweis nennt Laktose, Zutaten enthalten Sucralose. Claims "15 g Protein" (4,5 g × 3,3 = 14,85 g) und "ohne Zucker" (< 0,5 g/100 ml) sind rechnerisch plausibel.

## 6. Brand-Assets

### Farben (aus dem Inline-CSS der Custom-Sektionen, Häufigkeit in Klammern)

| Token (Vorschlag) | Wert | Verwendung im Ist |
|---|---|---|
| `magenta` | `#D9306E` | Primärfarbe, Buttons, aktive Zustände (`--pv-magenta`, `--mag`) |
| `aubergine` | `#4A2F39` | Fließtext, Überschriften (`--pv-aubergine`) |
| `wine` | `#6B1D49` | dunkle Flächen, Footer-Töne (28) |
| `plum` | `#7E2856` | Hover, sekundäre Akzente (18) |
| `berry` | `#702249` | Akzent (`--pv-berry`) |
| `cream` | `#FBF8EE` | Seitenhintergrund (`--pv-cream-bg`, 26) |
| `cream-2` | `#F3F1E7` | Galerie- und Kartenhintergrund (`--pv-cream2`) |
| `cream-3` | `#F4F1D4` | (`--pv-cream`) |
| `butter` | `#F3EDA4` | Hero-Flächen (18) |
| `butter-2` | `#F2F0B7` | Dawn-Farbschema-Hintergrund (`--color-background`) |
| `yellow` | `#E4DF6A` | Akzent (9) |
| `peach-cream` | `#F5E6CC` | Karten (9) |
| `pink` | `#E98AB0` | Sortenfarbe (`--pv-pink`) |
| `pink-light` | `#F7DCEB` | Flächen (`--pv-pink-light`, `--pink`) |
| `peach` | `#F7CA99` | Sortenfarbe (`--pv-peach`) |
| `mauve` | `#8A7680` | gedämpfter Text (13) |
| `mauve-2` | `#A08A94`, `#B58AA0`, `#C9BCC2` | Linien, Platzhalter |
| `sand` | `#E2D9D0`, `#D8CDC4`, `#ECE6D8` | Rahmen |
| `ink` | `#121212` | Dawn-Vordergrund |
| `success` | `#5BB572` | Erfolgsmeldungen |

### Typografie

- Hauptschrift: **Jost** (Google Fonts, Gewichte 300 bis 800), in allen Custom-Sektionen.
- Zusätzlich geladen: Outfit und Source Serif 4 (nur Messe-Seite), Assistant und DM Serif Text (Dawn-Standard in Footer, Cart-Notification, 404).
- Merkmale: Eyebrows in Versalien mit `letter-spacing: .06rem`, Headlines mit `letter-spacing: -.02em` und Gewicht 600 bis 700, Produkttitel per CSS `lowercase`, Buttons als Pills (`border-radius: 100px`), Karten mit 14 bis 26 px Radius.
- Lizenz: Jost, Outfit, Source Serif 4, Assistant und DM Serif Text stehen alle unter der SIL Open Font License 1.1 (geprüft gegen `google/fonts`, `METADATA.pb`). Selbst hosten ist erlaubt, die Lizenzdatei gehört mit ins Repo. Empfehlung: nur Jost weiterführen.

### Logos und Bilder

Alle Dateien liegen unter `assets/source/` (42 Dateien, 107 MB, Manifest mit Quelle, Größe und Maßen in `assets/source/manifest.json`).

| Datei | Maße | Verwendung |
|---|---|---|
| `logos/provibe-logo-wine.png` | 1000 × 297 | Header-Logo, JSON-LD |
| `logos/provibe-logo-cream.png` | 1000 × 297 | Logo hell (Messe-Seite) |
| `logos/Design_ohne_Titel_14.png` | 378 × 378 | Favicon |
| `images/provibe-wildberry.png`, `provibe-raspberry.png`, `provibe-peach.png` | 1300 × 2426, 405 × 760, 405 × 760 | Freigestellte Dosen (Startseite Sorten, Messe) |
| `images/Element_9_10x_….png` | 1516 × 2021 | Hero-Bild Startseite |
| `images/Untitled_Project_-_illustrationImage-6/-8/-20.png`, `IMG_0770_2….jpg` | 1517 × 1200, 1029 × 868, 4738 × 3702, 1853 × 1405 | Hauptbilder Wildberry, Raspberry-Lime, Mixed, Peach |
| `images/Untitled_Project_-_illustrationImage_17/_18/_19.jpg` | 3261 × 4032, 2655 × 3386, 2805 × 4027 | Stimmungsbilder Hochformat je Sorte |
| `images/Untitled_Project_-_illustrationImage-10/-13/-19.png` | 2048², 2742², 1296² | Quadratische Sortenbilder |
| `images/IMG_0764_2.jpg`, `IMG_0769_2.jpg` | 1869 × 1417, 2112 × 1600 | Fotos Wildberry, Peach |
| `images/UntitledProject-illustrationImage_22/_23.jpg`, `Untitled_Project_-_illustrationImage_25.jpg` | 5454 × 3600 | Hauptbilder Founder Bundle I, II, III |
| `images/Element_1…5_5x_*.png` (7 Dateien) | 1938 × 1269 bis 2855 × 2855 | Bundle-Detailbilder (Shirt-Motive, Becher) |
| `images/Gemini_Generated_Image_oygj7d…png` (2 Varianten) | 1824 × 2294 | Clear Cup (KI-generiert) |
| `images/Screenshot2026-06-1215.11.55.png` | 1838 × 665 | Shirt-Produktbild (Screenshot) |
| `images/IMG_2458_3.heic`, `Screenshot_2026-06-15_13.24.15.png`, `WhatsApp_Image_2026-06-15….jpg` | 3550 × 4733, 765 × 422, 939 × 797 | Über uns (HEIC muss konvertiert werden) |
| `images/Gemini_Generated_Image_bi69…/f9ly…/ik7v….png` | 1024 × 787, 864 × 1184 | Template-Seiten (provibe-paket, datenschutzerklarung) |
| `images/IMG_2200.jpg`, `Element_5.png` | 4288 × 2848, 483 × 546 | Kollektions-Hero, Messe |
| `images/Screenshot_2026-05-26_17.03.18_-_bearbeitet.png` | 1607 × 602 | OG-Image (zu klein, ersetzen) |
| `video/2717ef35153f40e5bbc51fa2f93a9008.mov` | QuickTime, 37 MB | Story-Video auf der PDP (für Web nach MP4/WebM transkodieren) |

Die Optimierung (AVIF/WebP, responsive Größen) passiert im Build, sobald das Projektgerüst steht. Bildbenennung und Alt-Texte legen wir beim Seed fest.

## 7. Gap-Liste: Was Shopify automatisch gemacht hat und wir selbst bauen

| Bereich | Shopify-Funktion | Ersatz im Nachbau |
|---|---|---|
| Checkout | gehosteter Checkout, Shop Pay, Beschleunigter Checkout ("oder sofort bezahlen") | eigener Checkout mit Stripe Payment Element, Express Checkout Element (Apple Pay, Google Pay, PayPal, Link) auf PDP und im Warenkorb. **Shop Pay entfällt ersatzlos.** |
| Zahlarten | Shopify Payments (Karten, Apple Pay, Google Pay, Klarna, PayPal), Banküberweisung | Stripe: Karten, Apple Pay, Google Pay, Klarna, PayPal (wenn fürs Konto freigeschaltet), SEPA optional. Banküberweisung nur, wenn gewünscht (Stripe "Customer Balance"). |
| Steuern | automatische MwSt. | eigene Steuerlogik (19 % Standard, pro Produkt pflegbar) |
| Rabattcodes | PRESALE10 im Checkout | eigenes Rabattmodul inklusive Eingabe im Warenkorb |
| Versand | Versandregeln, kostenlos ab 50 € | eigene Versandzonen und Tarife |
| Bestand | Inventory, Überverkaufsschutz | eigene Bestandsführung mit Reservierung |
| Bestellungen, Erstattungen | Shopify Admin | Backoffice, Stripe Refund API |
| Rechnungen | keine (Shopify erstellt keine Rechnungen) | Lexware Office |
| Kundenkonto | New Customer Accounts (passwortlos) | Supabase Auth mit Magic Link |
| Kontakt- und Partnerformular | Shopify Contact, Spamschutz durch Shopify | Netlify Function, Honeypot, Rate Limit, Lead-Liste |
| Newsletter | Shopify Customer Tag "newsletter", Shopify Email | Resend mit Double Opt-in, Protokoll |
| Widerrufsbutton | Shopify EU Widerrufsbutton App | eigenes Formular mit Eingangsbestätigung |
| Suche | Predictive Search (nur JS) | servergerenderte Suche über Produkte und Seiten |
| Bild-CDN | Shopify CDN mit `width`-Parametern, automatische HEIC-Konvertierung | Netlify Image CDN, HEIC vorab konvertieren |
| Video | Shopify Video-Hosting | eigenes Hosting (Supabase Storage oder Netlify), MP4/WebM |
| Sitemap, robots.txt, Canonicals, OG-Tags | automatisch | selbst generieren |
| Structured Data | nur Organization und WebSite | Organization, WebSite, BreadcrumbList, Product mit Offer je Variante |
| Analytics | Shopify Analytics, Web Pixels, Custom Pixel | eigene Tracking-Schicht, Meta, Google, TikTok, jeweils consent-gesteuert |
| Consent | Shopify Customer Privacy API (Banner nicht sichtbar) | eigenes Consent-Banner mit Log |
| Cookie-lose Basisfunktionen | Cart-Cookie, Session | eigener persistenter Warenkorb |
| Passwortschutz | Shopify Storefront Password | Netlify Password Protection oder `noindex` plus Basic Auth bis zum Go-live |
| Agent-Commerce | `agents.md`, UCP/MCP | entfällt, dafür `llms.txt` |
| Betrug, 3DS | Shopify Fraud Analysis | Stripe Radar, 3DS über Payment Element |
| Domains, SSL | automatisch | Netlify DNS-Einträge, Let's Encrypt |
| Rechtstexte-Hosting | Shopify Policies unter `/policies/*` | eigene Seiten, versioniert im Backoffice |

## 8. Auffälligkeiten, die wir bewusst nicht 1:1 übernehmen

1. Pfand "bereits im Preis inkl." statt getrennt ausgewiesen (PAngV § 7 verlangt die getrennte Angabe neben dem Gesamtpreis).
2. Statischer Grundpreis 8,03 €/l auf allen Varianten und auf Nicht-Getränken.
3. Streichpreise ohne dokumentierte Referenz (Packgrößen und Bundles).
4. Doppelte, leere oder falsch befüllte Seiten (`qrcode`, `qr-code-page-investoren`, `provibe-paket`, `provibe-founder-paket`, `datenschutzerklarung`, `widerrufsbutton`).
5. Google Fonts vom CDN.
6. Suchergebnisse nur per JavaScript.
7. Fehlende Produkt-Strukturdaten und Meta Descriptions.
8. "Lieferzeit aktuell 6–8 Wochen" (Pre-Sale) hart im Template, Versandseite sagt 3 bis 5 Werktage.
9. Platzhaltertext "Maßtabelle hier ergänzen" auf den Shirt-Bundles.
10. Widerspruch "laktosefrei" gegen Allergen "Laktose", Claim "100 % natürlich" trotz Sucralose.

## 9. Prüfmethode

- URLs: `curl -sSL` mit Browser-User-Agent, Statuscodes, `url_effective`, HTML gespeichert (`scratchpad/crawl/html/`).
- Metadaten: Regex-Extraktion von Title, Meta, Canonical, OG, JSON-LD, H1 (`pages.json`).
- Produktdaten: `products.json?limit=250`, `collections.json`, `collections/{handle}/products.json`, `cart/add.js` plus `cart.js` (Testartikel nur im anonymen Session-Cookie, keine Bestellung).
- Assets: Alle `src`, `srcset`, `poster`, `url()`-Referenzen auf `/cdn/shop/files/` gesammelt, `width`-Parameter entfernt, Originale geladen.
