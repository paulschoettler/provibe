# Go-live-Checkliste

Stand: 17.10.2026. Wird bis zum Go-live gepflegt. Punkte mit **Auftraggeber** brauchen dich.

## Vor dem Go-live offen (Erinnerungen)

- **Auftraggeber: Stripe.** Es gibt noch keinen Stripe-Account. Der Checkout läuft bis dahin gegen den Mock-Zahlungsanbieter. Nötig: Account anlegen (Firma CG Projects UG), Testkeys (sk_test, pk_test) in `.env.local` und Netlify eintragen, Webhook-Endpunkt `/api/webhooks/stripe` mit Signatur-Secret anlegen, Apple Pay Domain verifizieren, Klarna und PayPal im Dashboard aktivieren. Erst nach der Testbestellung mit Testkarte, Erstattung und Webhook-Prüfung der Wechsel auf Live-Keys, ausschließlich nach deiner Freigabe.
- **Auftraggeber: Resend.** Kein API-Key in `.env.local`, alle Mails laufen über den Mock und werden nur protokolliert. Nötig: Key mit Senderecht für die Domain provibe-drinks.de, Domain in Resend verifizieren (SPF, DKIM, DMARC laut Anleitung in `docs/setup.md`), Absender `hello@provibe-drinks.de` oder `no-reply@`, Reply-To `hello@`, Webhook für Bounces und Beschwerden. Bis zum Go-live bleibt die Allowlist (alle @provibe-drinks.de und mail@paulschoettler.de) aktiv.
- **Auftraggeber: Supabase Auth.** Site URL, Redirect-Liste, Linkgültigkeit 15 Minuten und Passwort-Mindestlänge 10 sind gesetzt. Deutsche E-Mail-Vorlagen (Magic Link, Bestätigung, Passwort, E-Mail-Wechsel) lassen sich im Free-Plan erst setzen, wenn Resend als Custom SMTP eingetragen ist (Auth, SMTP Settings); die Vorlagentexte liegen vorbereitet in `docs/setup.md`. Leaked-Password-Schutz (HIBP) braucht den Pro-Plan. Bis dahin verschickt Supabase englische Standardmails mit Code-Link.
- **Auftraggeber: Lexware Office** (Rechnungen) und **DHL** (Labels): Zugänge erst anlegen, wenn die Module stehen; bis dahin Mock und Entwürfe.
- Netlify: Repo wieder auf privat stellen, sobald die Git-Autor-Frage gelöst ist (Celines GitHub oder eigener Netlify-Account). Deploy Previews ohne Secrets.
- Rechtstexte: Gegenüberstellung alt gegen neu in `docs/rechtstexte-aenderungen.md` freigeben (Shopify-Passagen ersetzt, Bestellablauf, Zahlarten, Abo-Bedingungen).
- **Auftraggeber: Shopify-Exporte** (docs/import.md): Kunden, Bestellungen, Rabattcodes; für den Newsletter zusätzlich eine Quelle mit Einwilligungszeitpunkt (Shopify-Admin-Token nur mit read_customers oder Matrixify-Export), sonst wird niemand versandfähig (D3). Vorab ein Testexport mit wenigen Zeilen (C9). Bitte sagen, ob es Zeiträume ohne 0,25 € Pfand im Preis gab.
- Lieferungen aus Phase 1: Gewichte je Variante (für DHL), EANs, Etikett-Texte (LMIV-Abgleich), LUCID-Nummer fürs Impressum, Shopify-Exporte (Kunden, Bestellungen, Rabattcodes, Newsletter) für den Import.

## Technische Prüfungen vor dem DNS-Umzug

- Redirect-Test gegen das komplette alte URL-Inventar (`docs/analyse.md` Abschnitt 2), kein alter Pfad endet in 404.
- `curl`-Test ohne JavaScript auf jeder kundenseitigen Seite, Lighthouse und axe im Build.
- Testbestellung mit echter Zahlung und Erstattung, Bestellmail, Rechnung, Bestellung im Backoffice.
- Consent-Banner und Tracking (Meta, Google, TikTok) nur nach Einwilligung, Pixel-Prüfung.
- Sitemap in der Search Console einreichen, `noindex` und Passwortschutz entfernen, robots.txt prüfen.
- Backups: Point-in-Time-Recovery in Supabase aktivieren, geplanter Export.
- Shopify erst nach einer Übergangsphase kündigen, Domain bei Strato auf Netlify umstellen.

## Lückenanalyse Go-live (17.10.2026, Stand nach Storefront, Konto und Checkout)

Was noch fehlt, bevor der Shop den Shopify-Store ablösen kann. Reihenfolge nach Abhängigkeit; jeder Punkt bekommt Figma-Screens, wo es eine Oberfläche gibt, und wird danach gebaut.

1. **Backoffice** (in Arbeit): Welle 1 Shell, UI-Kit, Login mit Zwei-Faktor, Dashboard, Protokoll, Benutzer; Serverlogik aller Module. Welle 2 Modulseiten (Bestellungen, Produkte, Kollektionen, Bestand, Rabatte, Kunden, Segmente, Leads, Newsletter, Automationen, E-Mails, Inhalte, Einstellungen).
2. **Abo** (Figma Seite 07 in Arbeit): Datenmodell-Ergänzung, Abo-Lauf mit Jobs, Checkout-Umschalter, Portal, Kündigung ohne Login, Backoffice-Abos, Rechtstexte.
3. **Consent und Tracking** (Figma Seite 07): Consent-Banner und Einstellungen ohne Dark Patterns, Speicherung der Einwilligung (consent_logs), Tracking-Schicht mit Event-Schema aus Briefing 6 (page_view bis generate_lead), Meta Pixel 1372318701489027, Google und TikTok nur mit Einwilligung, Conversions-API serverseitig vorbereitet, Tracking-IDs aus den Einstellungen.
4. **Rechtstexte**: `docs/rechtstexte-aenderungen.md` mit Gegenüberstellung alt gegen neu (Shopify-Passagen durch Netlify, Supabase, Stripe, Resend, Lexware, DHL, Tracking ersetzen; Bestellablauf, Zahlarten, Abo-Bedingungen, Kündigungsbutton), eingespielt als Version 2 im Entwurf, Veröffentlichung erst nach deiner Freigabe. `docs/legal-checklist.md` (Button-Lösung, Grundpreis, Pfand, Widerruf, Datenschutz, Kontolöschung, Newsletter-Nachweis, Kündigungsbutton).
5. **Shopify-Import**: Skripte für Kunden (mit Aktivierungsmail), Bestellhistorie, Rabattcodes, Newsletter-Abonnenten mit Einwilligungsstatus; Probelauf gegen die lokale Datenbank, Bericht mit Zahlen; braucht deine Exporte.
6. **E-Mail-Vorlagen** vollständig: Versandbestätigung, Erstattung, Widerrufseingang, Konto aktivieren, Passwort, Abo-Mails; Vorschau im Backoffice; SPF, DKIM, DMARC Anleitung; Supabase-Auth-Mails auf Deutsch über Resend-SMTP.
7. **Qualität und Betrieb**: Playwright-E2E (Produkt in den Warenkorb, Rabattcode, Checkout mit Testkarte, Webhook, Bestellmail, Bestellung im Backoffice, Erstattung), No-JS-Check je Route, Lighthouse CI und axe im Build, CSP mit Stripe-Hosts, Fehler- und 404-Protokoll im Backoffice, Health-Check, Backups (PITR empfehlen, geplanter Export), Netlify-Kontexte.
8. **Restliche Storefront-Lücken**: Suche als Overlay im Header, Produktbewertungen anzeigen (reviews-Tabelle) nach Bewertungsanfrage, Google-Merchant-Feed (Phase 9), Blog-Editor im Backoffice (in Welle 1 Serverlogik), Produktfotos für Shirt und Cup (Auftraggeber), Handbuch `docs/handbuch.md` für den Betrieb.
9. **Go-live selbst**: Domain bei Strato auf Netlify, Stripe live, Webhooks live, Testbestellung mit echter Zahlung, Search Console, Übergangsphase Shopify.
