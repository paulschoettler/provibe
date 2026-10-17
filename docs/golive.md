# Go-live-Checkliste

Stand: 17.10.2026. Wird bis zum Go-live gepflegt. Punkte mit **Auftraggeber** brauchen dich.

## Vor dem Go-live offen (Erinnerungen)

- **Auftraggeber: Stripe.** Es gibt noch keinen Stripe-Account. Der Checkout läuft bis dahin gegen den Mock-Zahlungsanbieter. Nötig: Account anlegen (Firma CG Projects UG), Testkeys (sk_test, pk_test) in `.env.local` und Netlify eintragen, Webhook-Endpunkt `/api/webhooks/stripe` mit Signatur-Secret anlegen, Apple Pay Domain verifizieren, Klarna und PayPal im Dashboard aktivieren. Erst nach der Testbestellung mit Testkarte, Erstattung und Webhook-Prüfung der Wechsel auf Live-Keys, ausschließlich nach deiner Freigabe.
- **Auftraggeber: Resend.** Kein API-Key in `.env.local`, alle Mails laufen über den Mock und werden nur protokolliert. Nötig: Key mit Senderecht für die Domain provibe-drinks.de, Domain in Resend verifizieren (SPF, DKIM, DMARC laut Anleitung in `docs/setup.md`), Absender `hello@provibe-drinks.de` oder `no-reply@`, Reply-To `hello@`, Webhook für Bounces und Beschwerden. Bis zum Go-live bleibt die Allowlist (alle @provibe-drinks.de und mail@paulschoettler.de) aktiv.
- **Auftraggeber: Lexware Office** (Rechnungen) und **DHL** (Labels): Zugänge erst anlegen, wenn die Module stehen; bis dahin Mock und Entwürfe.
- Netlify: Repo wieder auf privat stellen, sobald die Git-Autor-Frage gelöst ist (Celines GitHub oder eigener Netlify-Account). Deploy Previews ohne Secrets.
- Rechtstexte: Gegenüberstellung alt gegen neu in `docs/rechtstexte-aenderungen.md` freigeben (Shopify-Passagen ersetzt, Bestellablauf, Zahlarten, Abo-Bedingungen).
- Lieferungen aus Phase 1: Gewichte je Variante (für DHL), EANs, Etikett-Texte (LMIV-Abgleich), LUCID-Nummer fürs Impressum, Shopify-Exporte (Kunden, Bestellungen, Rabattcodes, Newsletter) für den Import.

## Technische Prüfungen vor dem DNS-Umzug

- Redirect-Test gegen das komplette alte URL-Inventar (`docs/analyse.md` Abschnitt 2), kein alter Pfad endet in 404.
- `curl`-Test ohne JavaScript auf jeder kundenseitigen Seite, Lighthouse und axe im Build.
- Testbestellung mit echter Zahlung und Erstattung, Bestellmail, Rechnung, Bestellung im Backoffice.
- Consent-Banner und Tracking (Meta, Google, TikTok) nur nach Einwilligung, Pixel-Prüfung.
- Sitemap in der Search Console einreichen, `noindex` und Passwortschutz entfernen, robots.txt prüfen.
- Backups: Point-in-Time-Recovery in Supabase aktivieren, geplanter Export.
- Shopify erst nach einer Übergangsphase kündigen, Domain bei Strato auf Netlify umstellen.
