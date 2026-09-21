# Auftrag: PROVIBE Shop nativ nachbauen (Ablösung Shopify)

## 0. Deine Rolle und Arbeitsweise

Du bist Lead Engineer für dieses Projekt. Du baust den bestehenden Shopify-Store von PROVIBE (Eistee mit Protein, Marke der ICT) komplett als eigene Anwendung nach. Ziel: Nach dem Wechsel fehlt keine Funktion und keine Unterseite, Rankings bleiben erhalten, der Bestellprozess ist in Deutschland rechtskonform.

Aktueller Shop als Referenz: https://www.provibe-drinks.de/

So arbeitest du:

1. Starte mit einer Analysephase (Abschnitt 2) und schreibe das Ergebnis nach `docs/analyse.md`.
2. Stelle mir danach alle offenen Fragen gesammelt, jede Frage mit einer konkreten Empfehlung, die ich nur bestätigen oder anpassen muss. Rate nicht bei Dingen, die Recht, Geld oder Kundendaten betreffen.
3. Lege dann einen Phasenplan in `docs/plan.md` an und arbeite ihn Phase für Phase ab. Nach jeder Phase: kurzer Statusbericht, was fertig ist, was offen ist, was du von mir brauchst.
4. Arbeite so lange wie möglich ohne Zugänge. Baue alles gegen Interfaces mit Mock-Implementierungen (Stripe, Resend, Supabase lokal), pflege eine vollständige `.env.example` und frage Zugänge erst dann an, wenn du sie wirklich brauchst. Sag mir dabei genau, welchen Key mit welchen Rechten du brauchst.
5. Secrets landen nie im Repo, nie im Client-Bundle, nie in Logs.
6. Stripe zuerst ausschließlich im Testmodus. Den Wechsel auf Live mache ich nach deiner Checkliste selbst frei.
7. Führe ein `docs/decisions.md` (kurze ADRs) für jede Architekturentscheidung.

## 1. Tech-Stack (gesetzt)

- Hosting: Netlify (inklusive Functions, Scheduled Functions, Redirects, Image CDN)
- Datenbank, Auth, Storage: Supabase (Postgres, Row Level Security, Storage für Produktbilder)
- Zahlungen: Stripe
- E-Mail (transaktional und Newsletter): Resend
- Design Storefront: BYQ Supply MCP-Server (Designsysteme, Komponenten, Wireframes, Gems)
- Framework [ANNAHME, bitte in der Fragerunde bestätigen lassen]: Next.js (App Router, TypeScript, Tailwind) mit statischer Generierung plus On-Demand-Revalidation für alle kundenseitigen Seiten. Storefront und Backoffice leben in einem Repo, das Backoffice unter `/admin`. Falls du Astro für die Storefront für klar besser hältst, begründe das in der Fragerunde.

Harte Anforderung an das Rendering: Jede kundenseitige Seite liefert vollständiges HTML vom Server oder aus dem Build aus. Inhalte, Preise, Produkttexte, Überschriften und strukturierte Daten stehen im initialen HTML. Kein Inhalt darf nur per Client-JavaScript erscheinen. Prüfe das mit `curl` und dokumentiere den Test.

## 1a. Infrastruktur richtest du selbst ein

Ich will so wenig wie möglich von Hand klicken. Du übernimmst Einrichtung und Betrieb von Supabase und Netlify vollständig über deren MCP-Server, CLIs und APIs. Von mir bekommst du dafür auf Anfrage einen Supabase Access Token (plus Organisation beziehungsweise Projekt-Ref) und einen Netlify Personal Access Token. Prüfe zuerst, ob der Supabase-MCP-Server und die Netlify-CLI in deiner Umgebung verfügbar sind, und sag mir, was ich einmalig installieren oder autorisieren muss.

Supabase, von dir erledigt: Projekt in einer EU-Region (Frankfurt) anlegen oder das von mir angelegte übernehmen, alle Migrationen ausführen, RLS-Policies, Storage-Buckets mit Policies, Auth-Konfiguration (Magic Link, Passwort, 2FA für Admins, Redirect-URLs, Resend als SMTP für Auth-Mails), Datenbankfunktionen und Trigger, geplante Jobs, TypeScript-Typen generieren, Security- und Performance-Advisors prüfen und Befunde beheben, den ersten Owner-Account für mich anlegen.

Netlify, von dir erledigt: Site anlegen und mit dem Git-Repo verbinden, Build-Einstellungen, alle Umgebungsvariablen setzen, Functions und Scheduled Functions, Redirects und Security-Header in `netlify.toml`, Image CDN, Formular- und Webhook-Endpunkte, Deploys auslösen und Build-Logs selbst auswerten. Für die Domain bereitest du alles vor und gibst mir die exakten DNS-Einträge. Den DNS-Umzug selbst mache ich.

Gleiches Prinzip für Stripe (Webhooks, Zahlarten, Apple-Pay-Domain über API beziehungsweise CLI) und Resend (Domain anlegen, DNS-Einträge für SPF, DKIM, DMARC ausgeben, Webhooks, Audiences). Frag mich nur nach dem, was technisch zwingend ein Mensch tun muss, zum Beispiel Kontoverifizierung, DNS beim Registrar oder Zwei-Faktor-Bestätigungen, und gib mir dafür eine Klick-für-Klick-Anleitung.

Weil es nur eine Live-Instanz gibt, gelten diese Schutzregeln:

- Vor dem Go-live darfst du auf der Instanz frei arbeiten. Ab dem Import echter Kundendaten gilt sie als Produktion.
- Ab dann: Jede Migration testest du zuerst lokal, sie ist vorwärtskompatibel und hat einen dokumentierten Rückweg. Vor jeder Migration ziehst du ein Backup (`pg_dump` in einen privaten Speicherort). Empfiehl mir Point-in-Time-Recovery in Supabase.
- Destruktive Befehle (`DROP`, `TRUNCATE`, `DELETE` ohne enges `WHERE`, Reset von Migrationen, Löschen von Buckets, Pausieren oder Löschen des Projekts) führst du auf der Live-Instanz nie ohne meine ausdrückliche Freigabe im Chat aus.
- Bis zum Go-live liegt die Site hinter einem Passwortschutz oder einem `noindex`, damit Google die neue Seite nicht parallel zum Shopify-Shop indexiert. Den Schutz entfernst du erst im Zuge des DNS-Umzugs.
- Stripe läuft bis zu meiner Freigabe im Testmodus, Lexware-Rechnungen und DHL-Labels erzeugst du bis dahin nur als Entwurf beziehungsweise gegen Sandbox oder Mock. Testbestellungen markierst du und entfernst sie vor dem Go-live nach Rücksprache.
- Newsletter- und Automations-Versand bleibt bis zum Go-live hart auf eine Allowlist meiner Testadressen begrenzt, damit kein importierter Kunde versehentlich eine Mail bekommt.

## 2. Analysephase (vor jeder Zeile Produktivcode)

Crawle den bestehenden Shop vollständig und dokumentiere:

- Alle URLs: Startseite, `/pages/shop`, `/pages/uber-uns`, `/pages/partner`, `/pages/contact`, `/collections/all`, `/collections/aktion`, alle `/products/*` (Wildberry, Raspberry Lime, Peach, provibe Eistee mixed, Founder Bundle I, II, III und alles Weitere), `/cart`, Suche, Kundenkonto, Impressum, Datenschutz, AGB, Widerruf, Versand, Widerrufsformular (`/pages/widerruf-formular`). Nutze zusätzlich die bestehende `sitemap.xml`.
- Pro Seite: Title, Meta Description, H1, Canonical, OG-Tags, strukturierte Daten, Inhalte, Bilder.
- Alle Funktionen: Announcement-Bar ("Versandkostenfrei ab 50 €", Code PRESALE10), Variantenlogik über Packgrößen (9, 12, 18, 24, 36, 48 Dosen) mit eigenem Preis je Größe, Grundpreis pro Liter, Streichpreise bei Bundles, Bestseller-Modul auf der Startseite, Sofortkauf-Button, Suche, Login, Newsletter-Anmeldung im Footer, Zahlarten, Social Links (Instagram, TikTok).
- Brand-Assets: Farben (als Design Tokens), Schriften, Logos (unter anderem `provibe-logo-wine.png`), alle Produkt- und Stimmungsbilder. Lade die Assets in höchster Auflösung herunter, lege sie unter `assets/source/` ab und optimiere sie für die Auslieferung (AVIF/WebP, responsive Größen). Prüfe die Lizenz der Schriften, bevor du sie selbst hostest.
- Eingebundene Skripte und Apps (Pixel, Bewertungen, Pop-ups), damit wir nichts vergessen.

Ergebnis: `docs/analyse.md` mit URL-Inventar, Funktionsliste, Asset-Liste und einer Gap-Liste ("hat Shopify automatisch gemacht, müssen wir selbst bauen").

## 3. Storefront

### Seiten
Alle Seiten aus der Analyse, mit den bestehenden Inhalten. Dazu: 404-Seite, Bestellbestätigungsseite, Kundenkonto (Login per Magic Link oder Passwort, Bestellhistorie, Adressen, Rechnungsdownload, Newsletter-Einstellungen), Newsletter-Bestätigungsseite (Double Opt-in), Abmeldeseite.

### URL-Strategie
Behalte die bestehenden Pfade (`/products/...`, `/collections/...`, `/pages/...`, `/policies/...`) eins zu eins bei, damit Rankings und Backlinks erhalten bleiben. Wo eine Änderung nötig ist: 301-Redirect in `netlify.toml` und Eintrag in `docs/redirects.md`. Kein alter Pfad darf in einer 404 enden.

### Shop-Funktionen
- Produktdetailseite mit Variantenwahl (Packgröße), Preis, Grundpreis, Pfand (falls zutreffend), Lieferzeit, Zutaten, Nährwerttabelle, Allergenen, Galerie
- Kollektionen, Bundles mit Streichpreis, Bestseller-Modul
- Warenkorb (Drawer und eigene Seite), persistent über Sessions, Mengenänderung, Rabattcode-Eingabe, Fortschrittsanzeige bis zur Versandkostenfreigrenze
- Suche über Produkte und Seiten
- Announcement-Bar, im Backoffice pflegbar
- Newsletter-Anmeldung mit Double Opt-in
- Bewertungen: eigenes, schlankes Modul. Bewerten kann nur, wer das Produkt bestellt hat (Link aus der Bewertungsanfrage-Mail), Freigabe im Backoffice, Hinweis zur Echtheitsprüfung an den Bewertungen, `AggregateRating` im JSON-LD erst ab der ersten echten Bewertung.
- Kontaktformular und Partner-Anfrageformular mit Spam-Schutz (Honeypot plus Rate Limit, kein Google reCAPTCHA ohne Consent)

### Design
Nutze den BYQ Supply MCP-Server. Suche zuerst nach passenden Designsystemen (`search_byq_styles`) für eine junge, frische D2C-Getränkemarke, dann nach Komponenten und Wireframes für Hero, Produktkarten, PDP, Warenkorb, Checkout, Footer. Schlage mir zwei bis drei Richtungen mit kurzer Begründung vor, bevor du dich festlegst. Übersetze die PROVIBE-Brandfarben und Schriften in Tokens und lege sie über das gewählte System. Mobile first, denn der Traffic kommt überwiegend über Instagram und TikTok. Barrierefreiheit nach WCAG 2.1 AA (Barrierefreiheitsstärkungsgesetz): Kontraste, Tastaturbedienung, Fokus-Stile, Alt-Texte, Formular-Labels, `prefers-reduced-motion`.

## 4. Checkout und Stripe

- Eigener Checkout mit Stripe Payment Element (nicht die gehostete Stripe-Checkout-Seite), damit wir Bestellübersicht und Button-Text selbst kontrollieren.
- Zahlarten: Karte, Apple Pay, Google Pay, Klarna, PayPal (über Stripe, falls für das Konto verfügbar, sonst sag mir Bescheid und schlage die direkte PayPal-Integration vor), SEPA-Lastschrift optional. Shop Pay entfällt, weise mich in der Gap-Liste darauf hin.
- Gastbestellung ist möglich, Kontoerstellung ist optional.
- Preise, Rabatte, Versand und Steuern berechnet ausschließlich der Server. Der Client schickt nur Varianten-IDs und Mengen.
- Bestellung entsteht über den Stripe-Webhook (`payment_intent.succeeded`), mit Signaturprüfung und Idempotenz. Kein Auftrag nur aufgrund eines Client-Redirects.
- Bestandsführung mit Reservierung während des Checkouts, keine Überverkäufe.
- Rabattcodes: prozentual, fester Betrag, Gratisversand, Mindestbestellwert, Laufzeit, Nutzungslimit gesamt und pro Kunde. PRESALE10 lege ich als ersten Code an.
- Versandregeln: versandkostenfrei ab 50 €, darunter Pauschale, Länder und Tarife im Backoffice pflegbar. Start nur mit Lieferung nach Deutschland, Österreich als vorbereitete, abgeschaltete Versandzone.
- DHL: Bereite die Anbindung an das DHL Geschäftskundenportal (DHL Parcel DE Shipping API) vor. Label aus der Bestellung erzeugen, Gewicht aus den Varianten berechnen, Trackingnummer automatisch speichern, Versandmail mit Trackinglink auslösen, Sammeldruck für mehrere Bestellungen, Retourenlabel optional. Baue das hinter einem Interface mit Mock, bis ich Zugangsdaten und Abrechnungsnummer liefere. Manuelles Eintragen einer Trackingnummer bleibt immer möglich.
- Erstattungen (voll und teilweise) direkt aus dem Backoffice über die Stripe-API.
- Stripe einrichten: Sobald du so weit bist, fordere einen Restricted Key an und liste die nötigen Berechtigungen. Richte Webhook-Endpunkte, Zahlarten, Apple-Pay-Domain-Verifizierung und das Branding des Kontos ein. Dokumentiere jeden Schritt, den ich im Dashboard selbst erledigen muss.

## 5. Rechtskonformität (Deutschland, B2C)

Setze mindestens Folgendes um und lege eine Checkliste `docs/legal-checklist.md` an, die ich mit einem Anwalt oder einem Rechtstext-Dienst durchgehen kann. Du ersetzt keine Rechtsberatung, markiere Unsicherheiten deutlich.

- Button-Lösung (§ 312j BGB): Letzte Checkout-Seite zeigt unmittelbar vor dem Button alle wesentlichen Angaben (Produkte, Mengen, Gesamtpreis inklusive MwSt., Versandkosten, Pfand, Lieferzeit). Der Button trägt "Zahlungspflichtig bestellen" oder "Jetzt kaufen".
- Preisangabenverordnung: Gesamtpreise inklusive MwSt., Hinweis "inkl. MwSt. zzgl. Versand" mit Link, Grundpreis pro Liter überall dort, wo ein Preis steht (Listen, PDP, Warenkorb, Feeds). Pfand getrennt neben dem Preis ausweisen und nicht in den Grundpreis einrechnen, sobald Pfand anfällt.
- Streichpreise nur mit sauberer Referenz (niedrigster Preis der letzten 30 Tage bei Preisermäßigungen). Speichere dafür eine Preishistorie.
- Lebensmittelinformationsverordnung: Pflichtangaben vor Abschluss des Kaufs auf der PDP (Bezeichnung, Zutatenliste mit hervorgehobenen Allergenen, Nährwerttabelle, Nettofüllmenge, verantwortlicher Lebensmittelunternehmer mit Anschrift, Aufbewahrungshinweise, gegebenenfalls Koffeinhinweis). Diese Felder sind im Backoffice Pflichtfelder.
- Health-Claims-Verordnung: Aussagen wie "15 g Protein" oder "ohne Zucker" nur so verwenden, wie sie zulässig sind. Übernimm bestehende Claims, erfinde keine neuen.
- Widerruf: Widerrufsbelehrung, Muster-Widerrufsformular und die elektronische Widerrufsfunktion ("Vertrag widerrufen", Pflicht seit Juni 2026), dauerhaft erreichbar, mit Eingangsbestätigung per E-Mail. Kläre mit mir, ob und welche Ausnahmen für Lebensmittel wir in der Belehrung nutzen.
- Checkbox-freie, aber klare Einbindung von AGB und Widerrufsbelehrung im Checkout, keine vorangekreuzten Felder. Bestellbestätigung per E-Mail unverzüglich, mit AGB und Widerrufsbelehrung in Textform.
- Impressum, Datenschutzerklärung, AGB, Widerruf, Versand: Übernimm die bestehenden Texte vom aktuellen Shop vollständig. Ersetze darin jede Nennung von Shopify und Shopify-Diensten (Hosting, Checkout, Shop Pay, Shopify Payments, Shopify-Cookies) durch die neuen Dienstleister: Netlify (Hosting), Supabase (Datenbank, EU-Region), Stripe (Zahlung, inklusive Klarna und PayPal), Resend (E-Mail), Lexware Office (Rechnungen), DHL (Versand), Meta, Google und TikTok (Tracking, nur mit Einwilligung). Passe auch die Beschreibung des Bestellablaufs in den AGB an den neuen Checkout an. Lege mir eine Gegenüberstellung alt gegen neu in `docs/rechtstexte-aenderungen.md` ab, damit ich jede Änderung freigeben kann. Alle Texte sind im Backoffice editierbar und versioniert.
- Hinweis auf die Verbraucherstreitbeilegung nach § 36 VSBG.
- Consent (TDDDG, DSGVO): Consent-Banner mit gleichwertigen Buttons "Akzeptieren" und "Ablehnen", granulare Kategorien, Widerruf jederzeit über einen Footer-Link, Consent-Log in der Datenbank. Vor der Einwilligung lädt kein Tracking-Skript und setzt kein nicht notwendiges Cookie. Schriften und Skripte selbst hosten, keine Google Fonts vom CDN.
- Newsletter: Double Opt-in mit Protokoll (Zeitpunkt, IP, Text der Einwilligung), Abmeldelink in jeder Mail, Impressum in jeder Mail.
- Rechnungen: Lexware Office ist das führende System für Rechnungen. Nach erfolgreicher Zahlung legt der Server den Kunden in Lexware an (oder findet ihn über die E-Mail-Adresse), erzeugt die Rechnung über die Lexware-Office-API direkt finalisiert, mit korrektem Steuersatz je Position, Versandkosten, Rabatt und Pfand als eigene Positionen. Die Rechnungsnummer kommt aus dem Lexware-Nummernkreis, der Shop vergibt keine eigenen Nummern. Danach lädt der Server das PDF aus Lexware, speichert es unveränderbar in Supabase Storage und verschickt es über Resend an den Kunden (die Lexware-API versendet selbst keine E-Mails, prüfe das zu Beginn gegen die aktuelle API-Doku). Bei Erstattung erzeugst du in Lexware die passende Rechnungskorrektur. Technisch: eigene Job-Queue mit Retries und Idempotenz, Beachtung des Rate Limits der Lexware-API, Fehler sichtbar im Backoffice mit Button "erneut versuchen", Lexware-IDs und Deeplink an der Bestellung. Eine Bestellung darf nie an einem Lexware-Ausfall scheitern. Den API-Key fragst du bei mir an, sobald du ihn brauchst.
- DSGVO-Funktionen: Auskunft und Export pro Kunde, Löschung beziehungsweise Anonymisierung unter Beachtung der Aufbewahrungsfristen. Supabase-Projekt in einer EU-Region.
- Verpackungsgesetz: Feld für die LUCID-Nummer im Impressum beziehungsweise Footer vorsehen.

## 6. Tracking (vorbereiten, consent-gesteuert)

- Eine zentrale Tracking-Schicht mit einheitlichem Event-Schema: `page_view`, `view_item_list`, `view_item`, `search`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `sign_up` (Newsletter), `generate_lead` (Partnerformular).
- Meta: Pixel im Browser plus Conversions API serverseitig über eine Netlify Function, Deduplizierung über eine gemeinsame `event_id`, gehashte Kundendaten nur mit Einwilligung.
- Google: GA4 und Google Ads Conversion Tracking mit Enhanced Conversions, Consent Mode v2 mit korrekten Default-Werten. Optional GA4 Measurement Protocol für den serverseitigen `purchase`.
- TikTok: Pixel im Browser plus Events API serverseitig, gleichwertig zu Meta umgesetzt, mit Deduplizierung über die `event_id`. Dazu ein TikTok-Katalogfeed.
- Das `purchase`-Event feuert serverseitig aus dem Stripe-Webhook, damit kein Kauf durch geschlossene Tabs verloren geht.
- IDs (Pixel-ID, Measurement-ID, Ads-Conversion-Labels, Tokens) trage ich im Backoffice beziehungsweise in den Env-Variablen ein. Ohne IDs bleibt alles stumm.
- Produktfeeds: Google Merchant Center (XML) und Meta-Katalog, inklusive Grundpreis, GTIN, Verfügbarkeit.
- UTM-Parameter und Klick-IDs (`gclid`, `fbclid`, `ttclid`) mit Consent an der Bestellung speichern, damit das CRM die Quelle zeigt.

## 7. SEO und GEO

- Vollständig servergerendertes HTML (siehe Abschnitt 1), saubere Überschriftenhierarchie, semantisches HTML
- Pro Seite pflegbar: Title, Meta Description, Canonical, OG- und Twitter-Tags, Indexierungsstatus
- `sitemap.xml` (automatisch, mit `lastmod`, Bild-Sitemap), `robots.txt` (Admin, Warenkorb, Checkout, Konto, Suche ausschließen)
- JSON-LD: `Organization`, `WebSite` mit `SearchAction`, `BreadcrumbList`, `Product` mit `Offer` je Variante (Preis, Verfügbarkeit, `unitPricing`, Versand, Rückgabe), `AggregateRating` nur bei echten Bewertungen, `FAQPage` wo FAQs stehen
- GEO: `llms.txt` im Root, KI-Crawler in der `robots.txt` bewusst zulassen (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), klare Frage-Antwort-Blöcke auf PDPs und der Über-uns-Seite, eindeutige Fakten zu Produkt und Marke (Proteinmenge, Füllmenge, Zutaten, Hersteller) im Fließtext und in den strukturierten Daten
- Performance: Core Web Vitals im grünen Bereich auf Mobilgeräten, Lighthouse-Ziel 95 plus für Performance, SEO, Accessibility und Best Practices auf Startseite, Kollektion und PDP. Bilder über Netlify Image CDN, kritisches CSS, minimales Client-JavaScript.
- Vorbereitung für Google Search Console und Bing Webmaster Tools (Verifizierung per Meta-Tag oder DNS, Anleitung für mich)
- Blog/Magazin als einfaches CMS-Modul vorbereiten, damit wir später Content für SEO aufbauen können

## 8. Backoffice (`/admin`)

Clean, übersichtlich, an Shopify Admin angelehnt (linke Navigation, Listen mit Filtern, Detailseiten mit Karten), in den PROVIBE-Brandfarben als Akzent, ansonsten ruhig und neutral. Auch auf dem Handy bedienbar. Login über Supabase Auth mit Pflicht zur Zwei-Faktor-Authentifizierung, Rollen (Owner, Admin, Support, Fulfillment), Audit-Log für alle schreibenden Aktionen. `/admin` ist `noindex` und für Crawler gesperrt.

Module:

- Dashboard: Umsatz, Bestellungen, durchschnittlicher Warenkorb, Conversion, Top-Produkte, Neukunden gegen Bestandskunden, niedrige Bestände
- Bestellungen: Liste mit Filtern, Detailansicht, Statusfluss (offen, bezahlt, in Bearbeitung, versendet, zugestellt, storniert, erstattet), Erstattung, Rechnung und Lieferschein als PDF, Trackingnummer eintragen mit automatischer Versandmail, interne Notizen, manuelle Bestellung anlegen, CSV-Export
- Produkte: anlegen, bearbeiten, duplizieren, archivieren. Varianten mit eigenem Preis, Streichpreis, SKU, GTIN, Gewicht, Bestand. Bundles aus bestehenden Produkten mit Bestandsabzug auf Komponentenebene. Bilder-Upload mit Sortierung und Alt-Texten. LMIV-Pflichtfelder, Füllmenge für den automatischen Grundpreis, Pfand, Steuersatz, SEO-Felder, Kollektionen (manuell und regelbasiert)
- Bestand: Übersicht, Korrekturen mit Grund, Historie, Warnschwellen
- Rabatte: siehe Abschnitt 4
- Kunden (Mini-CRM): Profil mit Kontaktdaten, Adressen, Bestellhistorie, Umsatz gesamt, durchschnittlichem Bestellwert, erster und letzter Bestellung, Akquisequelle, Newsletter-Status mit Opt-in-Nachweis, Tags, Notizen, Aktivitäts-Timeline. Segmente über Filter (zum Beispiel "zwei plus Bestellungen", "seit 60 Tagen nichts gekauft", "hat Peach gekauft"), speicherbar und als Newsletter-Zielgruppe nutzbar. B2B- und Partneranfragen aus dem Partnerformular als eigene Lead-Liste mit Status.
- Newsletter über Resend: Kontakte mit Resend synchronisieren, Kampagnen mit einem einfachen Block-Editor in Brand-Optik (React Email), Testversand, Versand an Segment, Planung, Kennzahlen (Zustellung, Öffnungen, Klicks, Abmeldungen, Bounces über Resend-Webhooks), automatische Sperrliste bei Bounce und Beschwerde. Versand ausschließlich an Kontakte mit bestätigtem Opt-in.
- Automationen (einfach, abschaltbar): Willkommensmail nach Opt-in, Warenkorbabbrecher-Mail nur an Kontakte mit Werbeeinwilligung, Bewertungsanfrage nach Zustellung
- Transaktionale E-Mails über Resend, Vorlagen im Backoffice einsehbar: Bestellbestätigung, Zahlungsbestätigung, Versandbestätigung, Erstattung, Widerrufseingang, Double Opt-in, Magic Link, Passwort zurücksetzen. Anleitung für SPF, DKIM und DMARC auf der Absenderdomain.
- Inhalte: Seiten und Rechtstexte bearbeiten (versioniert), Startseiten-Module (Hero, Bestseller, Sorten, Bundles), Announcement-Bar, Navigation, Footer, Blog
- Einstellungen: Shopdaten, Versandzonen und Tarife, Steuern, Tracking-IDs, Rechnungsnummernkreis, Benutzer und Rollen

## 9. Datenmodell und Sicherheit

- Supabase-Migrationen als SQL-Dateien im Repo, reproduzierbar, mit Seed-Daten aus dem aktuellen Shop (alle Produkte, Varianten, Preise, Texte, Bilder)
- Row Level Security auf jeder Tabelle. Kunden sehen nur eigene Daten, Admin-Zugriffe laufen über geprüfte Rollen. Der Service-Role-Key existiert nur in Netlify Functions.
- Geldbeträge als Integer in Cent, Zeitstempel in UTC
- Eingaben serverseitig validieren (Zod), Rate Limits auf Formularen, Login und Rabattcode-Prüfung, Security-Header (CSP, HSTS), Schutz vor CSRF und XSS
- Backups: Supabase Point-in-Time-Recovery empfehlen, zusätzlich ein geplanter Export

## 10. Migration von Shopify

- Importskripte für Shopify-Exporte (CSV): Produkte, Kunden, Bestellhistorie, Rabattcodes, Newsletter-Abonnenten inklusive Einwilligungsstatus. Ich liefere die Exporte.
- Bestehende Kundenkonten: Kunden übernehmen, Passwörter lassen sich nicht migrieren, daher Login per Magic Link und eine freundliche "Konto aktivieren"-Mail.
- Go-live-Checkliste in `docs/golive.md`: DNS-Umzug zu Netlify, SSL, Redirect-Test gegen das komplette alte URL-Inventar, Stripe live, Webhooks live, Testbestellung mit echter Zahlung und Erstattung, Pixel-Prüfung, Sitemap in der Search Console einreichen, Shopify erst nach einer Übergangsphase kündigen.

## 11. Qualität

- TypeScript strict, ESLint, Prettier
- Unit-Tests für Preis-, Rabatt-, Versand-, Steuer- und Grundpreislogik
- End-to-End-Tests mit Playwright: Produkt in den Warenkorb, Rabattcode, Checkout mit Stripe-Testkarte, Webhook, Bestellmail, Bestellung im Backoffice, Erstattung
- Automatischer Check, dass jede kundenseitige Seite ohne JavaScript ihren Inhalt zeigt
- Lighthouse CI und ein Accessibility-Check (axe) im Build
- Es gibt nur eine Instanz: ein Supabase-Projekt und eine Netlify-Site, beides live. Kein Staging. Entwicklung und automatisierte Tests laufen lokal gegen Supabase per CLI (Docker) und gegen Stripe im Testmodus, niemals gegen die Live-Datenbank. Netlify Deploy Previews schaltest du ab oder gibst ihnen keine Live-Secrets, damit keine Vorschau auf Live-Daten schreibt.
- `README.md` mit Setup, Env-Variablen, Deploy, Betrieb. Dazu ein kurzes Handbuch fürs Backoffice in `docs/handbuch.md`.

## 12. Phasen (Vorschlag, passe ihn nach der Analyse an)

1. Analyse, Asset-Download, Fragenrunde
2. Projektgerüst, Design-Richtungen aus BYQ Supply, Tokens, Basiskomponenten
3. Datenmodell, Migrationen, Seed
4. Storefront-Seiten, SEO-Grundlagen
5. Warenkorb, Checkout, Stripe im Testmodus, Rechnungen, transaktionale Mails
6. Backoffice: Produkte, Bestellungen, Bestand, Rabatte, Inhalte
7. CRM, Newsletter, Automationen
8. Consent, Tracking, Feeds
9. Migration, Tests, Performance, Accessibility, Rechts-Checkliste
10. Go-live-Vorbereitung

## 13. Bereits getroffene Entscheidungen

Diese Punkte sind geklärt, frage sie nicht erneut ab:

- Framework: Next.js (App Router, TypeScript, Tailwind), statische Generierung mit On-Demand-Revalidation, Storefront und Backoffice in einem Repo.
- Checkout: eigener Checkout mit Stripe Payment Element.
- Pfand: Ob und in welcher Höhe Pfand anfällt, kläre ich verbindlich. Baue das Pfandfeld pro Produkt und die getrennte Ausweisung vollständig, Standardwert 0, sodass ich es ohne Codeänderung aktivieren kann.
- Lieferländer: Start nur Deutschland, Österreich vorbereitet und abgeschaltet.
- Versand: DHL Geschäftskundenportal vorbereiten (siehe Abschnitt 4).
- Rechnungen: Erzeugung direkt in Lexware Office, Versand des PDFs an den Kunden automatisch (siehe Abschnitt 5).
- Rechtstexte: bestehende Texte übernehmen, Shopify durch die neuen Dienstleister ersetzen, Gegenüberstellung zur Freigabe.
- Bewertungen: eigenes Modul mit Verifizierung über die Bestellung.
- Abo: in Phase 1 nur im Datenmodell vorbereiten (Tabellen für Abos, Intervalle, Stripe-Kundenbezug, gespeicherte Zahlungsmittel per SetupIntent möglich halten). Keine Oberfläche, kein Verkauf. Umsetzung inklusive Kündigungsbutton in Phase 2.
- Migration: alles migrieren (Produkte, Kunden, Bestellhistorie, Rabattcodes, Newsletter-Abonnenten). Die Daten kommen als Shopify-Export. Newsletter-Kontakte nur mit nachweisbarem Opt-in als versandfähig markieren, alle anderen als "nicht abonniert" importieren.
- Sprache: nur Deutsch, Architektur mehrsprachig vorbereitet (Locale im Routing und in den Inhaltstabellen).
- B2B: In Phase 1 bleibt die Partnerseite ein Anfrageformular mit Lead-Liste im CRM. Bereite den B2B-Shop für Phase 2 im Datenmodell vor: Kundentyp (B2C, B2B), Firmenfelder mit USt-IdNr., Preislisten pro Kundengruppe, Nettopreisanzeige, Mindestbestellmengen, Kauf auf Rechnung als Zahlart, Freischaltung von B2B-Konten im Backoffice. Keine B2B-Oberfläche in Phase 1.
- Tracking: Meta, Google und TikTok, jeweils Browser plus Server.
- Umgebungen: nur eine Live-Instanz, kein Staging. Supabase und Netlify richtest du selbst ein (Abschnitt 1a).

Starte jetzt mit Phase 1. Schreibe noch keinen Produktivcode, bevor ich deine Fragen beantwortet habe.
