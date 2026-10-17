# Plan: Kundenkonto, Login und Abo

Stand: 17.10.2026. Auftrag: ein vollständiges Authentifizierungs- und Mitgliedersystem (Login optional, Bestellhistorie einsehbar) und die Vorbereitung eines Abos mit einstellbarem Rabatt. Dieser Plan ist zur Freigabe gedacht, gebaut wird davon zunächst nur das Konto (Teil A), weil es für Bestellhistorie, Rechnungsdownload und Shopify-Bestandskunden ohnehin gebraucht wird. Das Abo (Teil B) folgt nach Freigabe.

## A. Konto und Login

### Ziele

Gastbestellung bleibt der Standard. Ein Konto ist freiwillig und bringt: Bestellhistorie mit Status und Tracking, Rechnungen als PDF, gespeicherte Adressen, Newsletter-Einstellung, später Abo-Verwaltung. Shopify-Bestandskunden bekommen ihr Konto per Aktivierungslink zurück, Passwörter lassen sich nicht migrieren.

### Technik

- Supabase Auth mit zwei Wegen: Magic Link (Standard, passwortlos) und Passwort (optional, Mindestlänge 10, Prüfung gegen die Have-I-Been-Pwned-Liste in Supabase aktivieren). Session per httpOnly-Cookies über `@supabase/ssr`, Zugriff in Server Components und Server Actions über `supabaseServer()`.
- Verknüpfung: `customers.auth_user_id` zeigt auf `auth.users.id`. Beim ersten Login wird der Kunde über die E-Mail gefunden oder angelegt (Trigger `on_auth_user_created` legt den `customers`-Datensatz an, wenn keiner existiert). Alle Bestellungen mit dieser E-Mail werden dem Kunden zugeordnet (`orders.customer_id`), auch Gastbestellungen von vorher. Der Gast-Warenkorb (Cookie `pv_cart`) wird beim Login in den Kundenwarenkorb überführt (`carts.status = merged`).
- RLS: Kunden lesen ausschließlich eigene Zeilen in `customers`, `customer_addresses`, `orders`, `order_items`, `invoices` (Policies mit `auth.uid()` über `customers.auth_user_id`). Schreibend nur Adressen, Profil und Newsletter-Wunsch, alles über Server Actions mit Zod.
- Aktivierung für Shopify-Bestandskunden: Importskript legt Kunden mit `shopify_customer_id` an. Die Aktivierungsmail (Resend, Vorlage `account_activate`) enthält einen Magic Link. Auf `/account/login` gibt es die Hinweisbox "Du hattest schon ein Konto bei uns?" mit Feld für die E-Mail.
- Sicherheit: Rate Limits auf Login und Magic-Link-Anfrage (Tabelle `rate_limits`), Links 15 Minuten gültig, Logout überall, Konto löschen mit Bestätigung (Bestellungen bleiben aus steuerlichen Gründen pseudonymisiert erhalten, Dokumentation in `docs/legal-checklist.md`).
- Mails über Resend: Magic Link, Konto aktivieren, Passwort zurücksetzen, E-Mail geändert. Bis zum Go-live über den Mock.

### Routen und Oberflächen (Figma Seite 03, Vorlagen Login, Konto-Übersicht, Bestelldetail)

`/account/login`, `/account` (Übersicht), `/account/bestellungen`, `/account/bestellungen/[nummer]` (Status-Stepper, Tracking, Rechnung, Widerruf), `/account/adressen`, `/account/daten` (Name, E-Mail, Passwort, Newsletter, Konto löschen), `/account/konto-aktivieren`. Im Header wechselt das Konto-Icon zwischen "Anmelden" und dem Vornamen. Auf der Bestellbestätigung die Karte "Konto anlegen" mit einem Klick (Magic Link an die Bestell-E-Mail).

### Backoffice

Kundenprofil zeigt Login-Status (aktiviert, nie eingeloggt, gesperrt), letzte Anmeldung, Möglichkeit "Aktivierungslink senden" und "Konto sperren". Alles im Audit-Log.

### Aufwand

Etwa zwei Arbeitspakete für Opus-Subagenten: (1) Auth-Schicht, Policies, Trigger, Aktivierung, Mails; (2) Kontoseiten nach Figma, Header-Zustand, Warenkorb-Übernahme. Dazu Tests für die Policies lokal gegen PostgreSQL 16.

## B. Abo mit einstellbarem Rabatt

### Fachliches Modell

- Abonnierbar sind die Packgrößen der Sorten und des Mixed-Produkts (9 bis 48 Dosen). Bundles und Merch nicht.
- Intervalle: alle 2, 4, 6 oder 8 Wochen (Standard 4). Mengen und Sorte jederzeit änderbar, nächste Lieferung überspringen, pausieren bis Datum, kündigen mit einem Klick (Kündigungsbutton nach § 312k BGB, Bestätigung per Mail).
- Rabatt: im Backoffice einstellbar, global (zum Beispiel 10 Prozent) und optional je Produkt oder Packgröße, gespeichert in Basispunkten (`subscriptions.discount_bp` wird beim Anlegen aus der aktuellen Einstellung übernommen, spätere Änderungen gelten nur für neue Abos, es sei denn, der Admin wendet sie ausdrücklich auf bestehende an). Der Rabatt wirkt auf den Warenwert, nie auf Pfand und Versand (`src/lib/pricing` kann das schon).
- Versand: Abo-Lieferungen ab dem Schwellenwert kostenlos wie sonst auch, ansonsten 4,90 €. Pfand je Lieferung ausgewiesen.
- Preisanpassung: Änderungen am Produktpreis gelten für Abos erst nach Ankündigung per Mail mit mindestens 4 Wochen Vorlauf (Feld `price_notice_sent_at`), der Kunde kann vorher kündigen.

### Technik (Empfehlung: eigene Abrechnung, Stripe nur für Zahlung)

Zwei Wege standen zur Wahl. Stripe Billing (Stripe verwaltet Laufzeit, Rechnung, Mahnung) ist schnell, aber unflexibel bei Pfand, Grundpreis, Sortenwechsel, Lexware-Rechnung und deutschem Kündigungsrecht. Empfehlung deshalb: Wir führen das Abo selbst (Tabelle `subscriptions`, schon vorhanden) und nutzen Stripe nur für das gespeicherte Zahlungsmittel und Off-Session-Zahlungen.

- Anlage: Im Checkout wählt der Kunde "Einmal kaufen" oder "Im Abo, alle 4 Wochen, 10 Prozent sparen" (auch auf der Produktseite als Umschalter). Abo erfordert ein Konto (wird im Checkout per Magic Link angelegt) und ein wiederverwendbares Zahlungsmittel (Stripe SetupIntent mit `usage: off_session`, Karte oder SEPA, PayPal falls freigeschaltet). Erste Lieferung ist eine normale Bestellung; das Abo startet mit `next_order_at`.
- Lauf: Ein geplanter Job (Netlify Scheduled Function täglich, Tabelle `jobs`) erzeugt fällige Bestellungen: Preise neu aus dem Katalog mit `discount_bp`, Bestand reservieren, PaymentIntent off_session mit gespeicherter Methode, bei Erfolg Bestellung "bezahlt", Rechnung über Lexware (Mock bis Key), Versandmail wie bei normalen Bestellungen. Drei Tage vor der Abbuchung geht eine Erinnerungsmail "Deine nächste Lieferung" mit Links zum Überspringen oder Ändern.
- Fehlerfälle: Zahlung abgelehnt → Status `past_due`, Mail mit Link zum Zahlungsmittel-Update, zwei automatische Wiederholungen (Tag 3 und Tag 7), dann Pause. 3-D-Secure-Anforderung off_session → Mail mit Link zur Bestätigung.
- Kundenportal unter `/account/abo`: Übersicht, nächste Lieferung, Sorte und Menge ändern, Intervall ändern, überspringen, pausieren, Zahlungsmittel ändern, Adresse ändern, kündigen (ein Klick plus Bestätigung, Grund optional).
- Backoffice `/admin/abos`: Liste mit Status, nächste Lieferung, Umsatz je Abo; Detail mit Historie der Lieferungen; Aktionen pausieren, überspringen, Rabatt anpassen, kündigen; Einstellungen für Standardrabatt, erlaubte Intervalle, Erinnerungsvorlauf. Kennzahlen im Dashboard: aktive Abos, monatlich wiederkehrender Umsatz, Kündigungsquote.
- Recht: Abo-Bedingungen in den AGB (§3 existiert schon, wird präzisiert), Widerrufsbelehrung für Dauerlieferverträge, Kündigungsbutton sichtbar auf der Website (nicht nur im Login, § 312k BGB verlangt eine ohne Login erreichbare Kündigungserklärung, wir setzen sie auf `/abo-kuendigen` mit E-Mail und Bestätigungslink), Pflichtangaben vor dem Button im Abo-Checkout (Laufzeit, Intervall, Preis je Lieferung, Kündigungsfrist "jederzeit zum nächsten Liefertermin"), Preisangabenverordnung mit Grundpreis je Lieferung.
- Datenmodell-Ergänzungen (neue Migration): `subscriptions.flavor_changes` nicht nötig (Variante austauschen reicht), zusätzlich `subscriptions.skip_next boolean`, `price_notice_sent_at`, `retry_count`, Tabelle `subscription_events` für die Historie (angelegt, geändert, übersprungen, pausiert, Zahlung fehlgeschlagen, gekündigt) und `shop_settings`-Einträge `subscription_discount_bp`, `subscription_intervals`, `subscription_reminder_days`.

### Aufwand

Drei Arbeitspakete: (1) Datenmodell, Preislogik und Abo-Lauf mit Jobs und Mocks samt Tests; (2) Checkout-Umschalter, SetupIntent, Kundenportal; (3) Backoffice-Abos, Einstellungen, Kennzahlen, Rechtstexte und Figma-Screens dafür (Seite 03 und 05/06 ergänzen).

## C. Reihenfolge

1. Teil A wird im Rahmen der Unterseiten gebaut (Login, Konto, Bestellhistorie sind im Seitenplan).
2. Teil B nach Freigabe dieses Plans, nach Checkout und Backoffice-Grundgerüst, weil er auf beidem aufsetzt und weil Stripe für Off-Session-Zahlungen echte Testkeys braucht.
