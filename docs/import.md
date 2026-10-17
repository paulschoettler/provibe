# Import der Shopify-Daten

Stand: 17.10.2026. Briefing Abschnitt 10, Antworten C5, C9, D3, F7 in `docs/fragen.md`, Kontoaktivierung nach `docs/konto-und-abo-plan.md` Teil A.

Die Skripte liegen unter `scripts/import/`. Sie lesen die offiziellen Shopify-Exporte (CSV, bei Rabatten auch JSON), zeigen im Probelauf einen vollständigen Bericht und schreiben erst mit `--apply`. Jeder angewendete Lauf steht mit Datei-Hash, Zahlen und Bericht in `import_runs` und lässt sich gezielt zurücknehmen.

Die echten Exporte liegen noch nicht vor (C9). Gebaut und getestet ist gegen das dokumentierte Shopify-Format mit erfundenen Beispieldaten in `scripts/import/fixtures/`.

## 1. Welche Exporte du in Shopify ziehst

Bitte immer **"Einfache CSV-Datei" (Plain CSV)** wählen, nicht die Excel-Variante, und die Datei nicht in Excel öffnen und neu speichern (Excel verändert Datumswerte, IDs und Umlaute).

| Export                  | Wo in Shopify                                                          | Hinweise                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Kunden                  | Kunden, oben rechts "Exportieren", "Alle Kunden", "Einfache CSV-Datei" | Enthält Customer ID, Name, E-Mail, Standardadresse, Tags, Notiz, "Accepts Email Marketing". Große Exporte schickt Shopify per Mail. |
| Rabattcodes             | Rabatte, "Exportieren", alle Rabatte                                   | Falls der Export bei dir fehlt oder nur automatische Rabatte zeigt: Liste per Admin-API als JSON, siehe Abschnitt 8.                |
| Bestellungen            | Bestellungen, "Exportieren", "Alle Bestellungen", "Einfache CSV-Datei" | Eine Zeile je Position. Bitte **alle** Bestellungen inklusive archivierter und stornierter.                                         |
| Newsletter-Einwilligung | Siehe unten                                                            | Der Kunden-Export enthält nur "yes/no", **keinen Einwilligungszeitpunkt**.                                                          |

**Newsletter-Zeitpunkt.** Laut D3 gilt nur ein Kontakt mit Status "subscribed" **und** Shopify-Zeitstempel als versandfähig. Der Standard-Kundenexport hat diesen Zeitstempel nicht. Ohne zusätzliche Quelle landet deshalb jeder Kontakt als "nicht abonniert". Es gibt zwei Wege zum Zeitstempel:

1. **Admin-API (empfohlen):** Abfrage `customers { email emailMarketingConsent { marketingState marketingOptInLevel consentUpdatedAt } }`, abgelegt als CSV oder JSON mit den Spalten `Email`, `Email Marketing Status`, `Consent Updated At`, `Opt-in Level`. Dafür brauche ich einen Admin-API-Token einer eigenen Shopify-App mit genau dem Recht `read_customers` (Variable `SHOPIFY_ADMIN_TOKEN`, nur lokal, nie in Netlify). Alternativ ziehst du die Liste selbst.
2. **Export-App** (zum Beispiel Matrixify): Kundenexport mit den Spalten "Email Marketing: Status" und "Email Marketing: Updated At". Das Skript erkennt diese Spaltennamen.

Produkte und Varianten sind bereits über den Shopify-Snapshot im Seed (`assets/source/data/shopify-snapshot/`, `product_variants.shopify_variant_id`). Bestände (C5, H3) sind nicht Teil dieser Skripte.

## 2. Reihenfolge

1. **Kunden** (`import:customers`): legt die Kunden an, auf die sich Bestellungen und Newsletter beziehen.
2. **Rabatte** (`import:discounts`): damit Bestellungen ihren Rabattcode verknüpfen können.
3. **Bestellungen** (`import:orders`): verknüpft Kunden über die E-Mail und Rabattcodes über den Code.
4. **Newsletter** (`import:newsletter`): verknüpft Kontakte mit den Kunden.

Jeder Schritt lässt sich beliebig oft wiederholen. Bereits importierte Datensätze werden erkannt (siehe Abschnitt 6) und übersprungen oder abgeglichen.

## 3. Probelauf lokal

Alles läuft zuerst gegen die lokale Datenbank (ADR-003, PostgreSQL 16 ohne Docker):

```bash
pnpm db:migrate:local                       # frische lokale DB mit allen Migrationen

pnpm import:customers  -- --file ~/Downloads/customers_export.csv
pnpm import:discounts  -- --file ~/Downloads/discounts_export.csv
pnpm import:orders     -- --file ~/Downloads/orders_export.csv
pnpm import:newsletter -- --file ~/Downloads/customers_export.csv --subscribers ~/Downloads/newsletter_consent.csv
```

Ohne `--apply` ist jeder Aufruf ein **Probelauf**: Das Skript rechnet alles in einer Transaktion gegen die echte Tabellenstruktur durch (inklusive Constraints und Trigger) und rollt am Ende zurück. Der Bericht zeigt Dateizeilen, Datensätze, angelegt, aktualisiert, unverändert, übersprungen und Fehler, jeweils mit Zeile und Grund.

Zum Schreiben denselben Aufruf mit `--apply` wiederholen. Weitere Optionen:

| Option                  | Wirkung                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--apply`               | schreibt, eine Transaktion je 200 Datensätze, ein Savepoint je Datensatz (ein Fehler verwirft nur diese Zeile) |
| `--batch-size <n>`      | andere Blockgröße (1 bis 1000)                                                                                 |
| `--report <datei.json>` | Bericht zusätzlich als JSON                                                                                    |
| `--out <ordner>`        | Ordner für die Aktivierungsliste (Standard `scripts/import/out/`, gitignoriert)                                |
| `--send-activation`     | nur Kunden, nur mit `--apply`: Aktivierungsmails, siehe Abschnitt 5                                            |
| `--subscribers <datei>` | nur Newsletter: zusätzliche Liste mit Einwilligungszeitpunkten                                                 |

Ziel ist ohne weitere Angabe `postgres://postgres@localhost:54329/provibe`. Eine andere lokale Datenbank setzt du mit `DATABASE_URL=postgres://postgres@localhost:54329/<name>`. Die Skripte laden `.env.local` bewusst **nicht**.

**Probelauf mit den Beispieldateien** (17.10.2026, frische lokale DB, Reihenfolge wie oben):

| Lauf                                    | Ergebnis                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kunden (5 Zeilen)                       | 4 angelegt, 1 übersprungen (Kunde nur mit Telefon), 1 Hinweis (Adresse unvollständig, nicht übernommen), 4 Konten zu aktivieren, 1 Aktivierungsmail an die Allowlist-Adresse (Mock), 3 blockiert |
| Rabatte (5 Zeilen)                      | 3 angelegt, 1 aktualisiert (PRESALE10, kein Duplikat), 1 übersprungen (Buy X get Y)                                                                                                              |
| Bestellungen (6 Zeilen, 4 Bestellungen) | 4 angelegt mit 6 Positionen, 1 freie Position (unbekannte SKU), 1 Gastbestellung, Status delivered, paid, partially_refunded, cancelled, Nummernkreis PV unverändert                             |
| Newsletter (5 + 4 Zeilen)               | 5 Kontakte: 2 abonniert mit Zeitstempel, 1 "Ja ohne Zeitstempel" und 2 ohne Einwilligung als nicht abonniert, 1 übersprungen (ohne E-Mail)                                                       |
| Wiederholung aller Läufe                | 0 angelegt, alles unverändert beziehungsweise "bereits importiert"                                                                                                                               |
| Rückweg Bestellungen, dann Rabatte      | 4 Bestellungen gelöscht, Kundenkennzahlen neu gerechnet; 3 Rabatte gelöscht, PRESALE10 im Vorzustand; erneuter Import danach fehlerfrei                                                          |

Tests der Parser, des Mappings und der Pfandrechnung: `pnpm test:import` (55 Tests).

## 4. Was die Skripte tun

### Kunden

- Abgleich zuerst über `shopify_customer_id`, sonst über die E-Mail (citext, Groß/Kleinschreibung egal).
- Neu: E-Mail (klein geschrieben), Name, Telefon, Firma, Tags plus `shopify_import`, `acquisition_source = import_shopify`, `acquisition_details.import_shopify` mit Importzeitpunkt, Lauf-ID, Shopify-Umsatz, Bestellanzahl, Marketing- und Steuerangaben. `orders_count` und `total_spent_cents` übernehmen die Shopify-Werte, bis der Bestellungsimport sie per Trigger aus den echten Bestellungen neu rechnet.
- Bestehend: vorhandene Werte haben Vorrang (der Kunde kann sie im neuen Shop schon geändert haben), nur leere Felder werden gefüllt, Tags ergänzt. Die E-Mail wird nie geändert (Login-Verknüpfung). Gelöschte Kunden werden übersprungen.
- Standardadresse als `customer_addresses` (Straße und Hausnummer getrennt, wie DHL es braucht), als Standard markiert, wenn der Kunde noch keine Standardadresse hat. Gleiche Adresse wird nicht doppelt angelegt.
- Shopify-Notiz als interne Kundennotiz, Ereignis `imported` beziehungsweise `import_updated` in der Kunden-Timeline.
- **Kein Auth-Benutzer.** Stattdessen die Aktivierungsliste `scripts/import/out/aktivierung-*.csv` (Kunden-ID, E-Mail, Name, Shopify-ID, neu ja/nein, auf Allowlist, Versandzeitpunkt). Die Datei enthält Personendaten und bleibt lokal.

### Rabatte

- Abgleich über `shopify_discount_id`, sonst über den Code. PRESALE10 wird aktualisiert, nicht doppelt angelegt.
- Prozent in Basispunkten (10 % = 1000), Festbetrag in Cent, Versandrabatt als `free_shipping`. Shopify exportiert Werte oft negativ, das Vorzeichen spielt keine Rolle.
- Mindestbestellwert in Cent. Mindestmengen ("Minimum quantity of 2 items") und Buy-X-get-Y lassen sich nicht abbilden: Zeile übersprungen mit Grund, bitte im Backoffice anlegen.
- "Times Used" wird zu `usage_count`, aber nie verringert. Abgelaufene Codes werden inaktiv, geplante bleiben aktiv mit `starts_at`. Codes, die in Shopify nur für bestimmte Produkte oder Kollektionen galten, kommen **inaktiv** und mit Hinweis an, damit kein Rabatt breiter gilt als vorher.

### Bestellungen

- Zeilen werden über die Spalte Name zur Bestellung zusammengefasst. Bestellwerte stehen bei Shopify nur in der ersten Zeile, das Skript nimmt je Spalte den ersten nicht leeren Wert.
- **Bestellnummer:** Die Shopify-Nummer bleibt erhalten, als `order_number` (zum Beispiel `#1042`) und in `shopify_order_name`. Das passt zu Konto, Widerrufsformular und `parseOrderNumber()`, die importierte Nummern im Format `#1042` erwarten. Weil `order_number` explizit gesetzt wird, greift der Default `next_order_number()` nicht, die Sequenz `order_number_seq` (PV-10001 …) bleibt unberührt. Das Skript prüft das vor und nach jedem Lauf und meldet jede Abweichung. Eine neue Spalte war nicht nötig.
- **Varianten:** zuerst über die SKU (neues Schema wie `PV-WB-09` oder Legacy wie `WILDBERRY-1`), dann über den Positionsnamen ("Wildberry Eistee - 9", "Founder Bundle ll - M"), abgeglichen mit dem Shopify-Snapshot über `shopify_variant_id` und mit den Namen in der Datenbank. Ohne Treffer entsteht eine freie Position mit dem Shopify-Namen, ohne Pfand, mit Hinweis im Bericht und im Bestellereignis.
- **Pfand:** Shopify-Preise enthielten das Pfand. Je Position gilt `unit_deposit_cents = unit_count × deposit_cents_per_unit` (Bundles: Summe der Komponenten, 6 × 0,25 € = 1,50 €, wie im Checkout, H1) und `unit_price_cents = Shopify-Preis − Pfand`. Die Rechnung nutzt `depositPerItemCents()` aus `src/lib/cart/mapping.ts`, also dieselbe Logik wie Warenkorb und Checkout. Grundpreis-Text als Snapshot über `src/lib/pricing`.
- **Rabatt:** Positionsrabatte aus "Lineitem discount". Fehlen sie, wird der Bestellrabatt anteilig verteilt (`allocateProportionally`), aber nur, wenn die Summen aufgehen. `total_cents` ist immer das Shopify-Total. Weicht die eigene Summe (Warenwert + Pfand − Rabatt + Versand) um mehr als 1 Cent ab, steht ein Hinweis im Bericht.
- **Steuer:** `tax_cents` aus "Taxes", `tax_lines` aus "Tax 1 Name/Value" bis "Tax 5" (Satz aus dem Namen, zum Beispiel "DE MwSt 19%"), Positionen mit diesem Satz, sonst 19 %.
- **Status:**

  | Shopify                                   | payment_status                | status                                   |
  | ----------------------------------------- | ----------------------------- | ---------------------------------------- |
  | Cancelled at gesetzt                      | wie Financial Status          | cancelled                                |
  | refunded / partially_refunded             | refunded / partially_refunded | refunded / partially_refunded            |
  | paid, fulfilled, Versand älter als 7 Tage | paid                          | delivered                                |
  | paid, fulfilled, Versand jünger           | paid                          | shipped                                  |
  | paid, partial                             | paid                          | processing                               |
  | paid, unfulfilled                         | paid                          | paid (offen, muss noch versendet werden) |
  | authorized                                | authorized                    | pending                                  |
  | pending, partially_paid, voided           | unpaid                        | pending                                  |
  | expired                                   | failed                        | pending                                  |

  `fulfillment_status` 1:1 (fulfilled, partial, sonst unfulfilled), `shipped_at` aus "Fulfilled at", `paid_at` aus "Paid at".

- Kunde über die E-Mail verknüpft. Ohne Kundendatensatz bleibt die Bestellung Gastbestellung, `claim_guest_orders_for()` ordnet sie beim ersten Login zu.
- Rabattcode wird verknüpft und als Einlösung vermerkt (für Limits je Kunde), der Zähler `usage_count` bleibt dabei unverändert, weil er aus dem Rabattimport kommt.
- "Refunded Amount" wird als Erstattung (`refunds`, Anbieter `shopify`) übernommen, eine Tracking-Spalte (falls vorhanden) als Sendung.
- `is_test = false`, `source = import_shopify`, `payment_provider = shopify`, Ereignis `imported` (nicht für Kunden sichtbar) mit Shopify-Status, Zahlungsart, Tags und Hinweisen.
- **Keine Mails, keine Jobs, keine Bestandsbewegungen, keine Rechnungen.** Die Skripte rufen weder `commit_reservations` noch den Job-Runner auf.

### Newsletter

- Quellen: Kunden-Export ("Accepts Email Marketing") und optional die Liste mit Einwilligungszeitpunkt (`--subscribers`), die je E-Mail Vorrang hat.
- **Abonniert** nur mit "subscribed/yes" **und** Zeitpunkt: `status = subscribed`, `imported_consent_at` = Shopify-Zeitpunkt, `source = import_shopify`, `consent_text = "Shopify-Import, Einwilligung laut Export"`, `consent_version = shopify_import`, Tag mit Opt-in-Stufe (zum Beispiel `shopify_single_opt_in`).
- **Alle anderen** als `unsubscribed` mit Grund in `unsubscribe_reason`: `import_shopify_keine_einwilligung`, `import_shopify_ohne_zeitstempel` oder `import_shopify_zeitstempel_in_zukunft`. Der Importzeitpunkt zählt nie als Einwilligung.
- Kontakte aus dem neuen Shop haben Vorrang: eigene Double-Opt-in-Bestätigungen und Abmeldungen werden nie überschrieben. Nur ein offenes Double Opt-in ("pending") wird durch eine belegte Shopify-Einwilligung ersetzt.
- Kein Versand und kein Abgleich mit Resend. Der Bericht zeigt die Zahlen je Status.

## 5. Aktivierungsmails

```bash
pnpm import:customers -- --file customers_export.csv --apply --send-activation --rate 20 [--limit 50] [--resend]
```

- Versand über `sendActivationMail()` aus `src/lib/auth/mails.ts` (Vorlage `account_activate`) und `integrations().email`. Deshalb läuft das Kundenskript mit `tsx --conditions=react-server` (die Datei ist `server-only`).
- **Allowlist bis zum Go-live** (F7): nur Adressen aus `EMAIL_ALLOWLIST` (Standard `@provibe-drinks.de,mail@paulschoettler.de`). Der Mail-Provider prüft die Allowlist nicht selbst, deshalb prüft das Skript vor jedem Versand. Der Eintrag `*` gilt nur mit `APP_STAGE=production` und `APP_INTEGRATIONS=live`.
- Rate: höchstens `--rate` Mails pro Minute (Standard 20, maximal 120). Bereits angeschriebene Kunden (`activation_email_sent_at`) werden übersprungen, außer mit `--resend`.
- Link: lokal und im Mock-Modus zeigt der Link auf `/account/konto-aktivieren`, dort fordert die Person einen frischen Link an. Mit `APP_INTEGRATIONS=live` und `--remote` erzeugt das Skript wie das Backoffice einen Magic Link über `auth.admin.generateLink` (Achtung, siehe Offene Punkte: Gültigkeit 15 Minuten).
- Nach dem Versand: `activation_email_sent_at` und Ereignis `activation_email_sent` in der Kunden-Timeline.

## 6. Idempotenz und Protokoll

| Art          | Wiedererkennung                                                                        |
| ------------ | -------------------------------------------------------------------------------------- |
| Kunden       | `shopify_customer_id`, sonst E-Mail                                                    |
| Rabatte      | `shopify_discount_id`, sonst Code                                                      |
| Bestellungen | `shopify_order_id` (Spalte Id), sonst `shopify_order_name` mit Quelle `import_shopify` |
| Newsletter   | E-Mail                                                                                 |

Jeder Lauf mit `--apply` legt einen Eintrag in `import_runs` an (Migration `20261017106000_import_runs.sql`): Art, Dateiname, SHA-256 der Datei, weitere Dateien, Optionen, Zeilen, Zahlen je Ergebnis, Bericht (`result`, mit Fehlern je Zeile), Systembenutzer, Start und Ende. Jede angelegte oder geänderte Zeile steht in `import_run_items` mit Vorzustand. Wird dieselbe Datei erneut angewendet, weist der Bericht darauf hin. Probeläufe schreiben nichts.

```sql
select id, kind, status, file_name, rows_total, created_count, updated_count, skipped_count, error_count, started_at
from public.import_runs order by started_at desc;
```

## 7. Anwendung auf der Live-Datenbank

Erst nach dem Probelauf mit den echten Dateien und nach Rücksprache. Ab dem Import echter Kundendaten gilt die Instanz als Produktion (CLAUDE.md, Schutzregeln).

1. Migration `20261017106000_import_runs` per Supabase-MCP `apply_migration` mit identischem Namen anwenden (vorher lokal geprüft).
2. **Backup** ziehen und privat ablegen, nicht im Repo:
   ```bash
   pg_dump "$SUPABASE_DB_URL" --format=custom --file ~/provibe-backups/vor-import-$(date -u +%Y%m%dT%H%MZ).dump
   ```
3. Probelauf gegen die Live-Datenbank (schreibt nichts, rollt zurück):
   ```bash
   DATABASE_URL="$SUPABASE_DB_URL" pnpm import:customers -- --file customers_export.csv --remote --backup ~/provibe-backups/vor-import-….dump
   ```
4. Gleicher Aufruf mit `--apply`, in der Reihenfolge aus Abschnitt 2. Jeder Lauf braucht `--remote` und ein Backup, das höchstens 24 Stunden alt ist, sonst bricht das Skript ab.

**Technik:** Die Skripte schreiben über eine direkte PostgreSQL-Verbindung (`pg`) als Datenbank-Eigentümer, nicht über den Supabase-REST-Client. Grund: Nur so gibt es echte Transaktionen je 200 Datensätze mit Savepoint je Zeile und einen Probelauf, der gegen die echten Constraints und Trigger rechnet und vollständig zurückrollt. RLS wird dabei wie mit dem Service-Role-Key umgangen. Für remote die Verbindungszeichenfolge "Direct connection" oder "Session pooler" aus dem Supabase-Dashboard verwenden (nicht den Transaction pooler, der keine Sitzungs-Transaktionen über mehrere Befehle garantiert). Ohne `DATABASE_URL` nimmt das Skript immer die lokale Datenbank, jede andere Adresse braucht `--remote` und `--backup`. Für den Magic-Link-Versand braucht das Kundenskript zusätzlich `NEXT_PUBLIC_SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` in der Umgebung.

## 8. Rückweg je Lauf

```bash
pnpm import:rollback -- --run <import_runs.id>            # Probelauf, zeigt die Wirkung
pnpm import:rollback -- --run <import_runs.id> --apply    # nimmt den Lauf zurück
```

- Angelegte Zeilen werden gelöscht (Bestellungen samt Positionen, Ereignissen, Sendungen, Erstattungen und Einlösungen per Cascade), geänderte bekommen ihren Vorzustand aus `import_run_items.before`. Alles in einer Transaktion, in umgekehrter Reihenfolge. Danach steht der Lauf auf `rolled_back`.
- Reihenfolge beim Zurücknehmen: **Newsletter, Bestellungen, Rabatte, Kunden.** Das Skript verweigert einen Kunden-Rückweg, solange importierte Bestellungen an diesen Kunden hängen, und einen Rückweg, wenn spätere Läufe dieselben Zeilen geändert haben (`--force` übergeht beides).
- Kunden, die inzwischen ihr Konto aktiviert oder im neuen Shop bestellt haben, bleiben samt Adressen und Notizen stehen (Hinweis im Ergebnis).
- Nach gelöschten Bestellungen rechnet das Skript `orders_count`, `total_spent_cents`, erste und letzte Bestellung neu (aus den verbleibenden Bestellungen, nicht aus den Shopify-Werten).
- Ein wiederhergestellter Vorzustand überschreibt auch spätere Änderungen an dieser Zeile. Rückwege deshalb zeitnah ausführen.
- Auf der Live-Datenbank ist das ein destruktiver Befehl: nur mit ausdrücklicher Freigabe im Chat, frischem Backup und `--remote --backup`. Letzte Stufe ist das Backup aus Abschnitt 7 (`pg_restore`).
- Die Migration selbst hat ihren Rückweg als Kommentar (`drop table import_run_items; drop table import_runs;`).

## 9. Annahmen zum Spaltenformat

Spaltennamen werden ohne Groß/Kleinschreibung erkannt, Trennzeichen Komma, Semikolon oder Tab, UTF-8 mit oder ohne BOM, Felder mit Zeilenumbruch in Anführungszeichen.

- **Kunden:** aktuelles Format (`Customer ID`, `First Name`, `Last Name`, `Email`, `Accepts Email Marketing`, `Default Address Company/Address1/Address2/City/Province Code/Country Code/Zip/Phone`, `Phone`, `Accepts SMS Marketing`, `Total Spent`, `Total Orders`, `Note`, `Tax Exempt`, `Tags`) und älteres Format (`Company`, `Address1`, `Address2`, `City`, `Province Code`, `Country`, `Country Code`, `Zip`, `Accepts Marketing`). Das Apostroph, das Shopify vor IDs und Telefonnummern setzt (`'+49…`), fällt weg.
- **Bestellungen:** offizielle Spalten des Bestellexports (`Name`, `Email`, `Financial Status`, `Paid at`, `Fulfillment Status`, `Fulfilled at`, `Currency`, `Subtotal`, `Shipping`, `Taxes`, `Total`, `Discount Code`, `Discount Amount`, `Shipping Method`, `Created at`, `Lineitem quantity/name/price/sku/fulfillment status/discount`, `Billing …`, `Shipping …`, `Notes`, `Note Attributes`, `Cancelled at`, `Payment Method`, `Payment Reference`, `Refunded Amount`, `Id`, `Tags`, `Source`, `Tax 1 Name/Value` bis `Tax 5`, `Phone`). Pflicht: Name, Email, Created at, Total, Lineitem quantity/name/price. Optional erkannt: `Tracking Number`, `Tracking Company`, `Tracking URL`. Nur EUR.
- **Rabatte:** `Code` (oder `Name`, `Title`), `Type` (oder `Value Type`), `Value`, `Minimum`, `Usage limit`, `Once per customer`, `Times Used`, `Starts at`, `Ends at`, `Status`, optional `Id`, `Applies to`, `Combines with`. JSON aus der Admin-API mit gleichnamigen Feldern geht auch (`code`, `value_type`, `value`, `usage_limit`, `once_per_customer`, `starts_at`, `ends_at`).
- **Newsletter-Zeitpunkt:** eine der Spalten `Accepts Email Marketing Updated At`, `Email Marketing Consent Updated At`, `Email Marketing: Updated At`, `Consent Updated At`, `consentUpdatedAt`, `Subscribed At`; Status aus `Email Marketing Status`, `Email Marketing: Status`, `Marketing State`, `Status` oder "Accepts Email Marketing".
- **Datum:** `2026-05-10 14:03:15 +0200` (CSV), ISO 8601 mit Zone (API), ohne Zone gilt die Shop-Zeitzone Europe/Berlin. Gespeichert wird UTC.
- **Beträge:** `26.10`, `26,10`, `1,234.56`, `1.234,56`, auch mit Euro-Zeichen oder negativ. Gespeichert wird Integer in Cent.

## 10. Offene Punkte

- **Echter Testexport (C9):** Mit wenigen echten Zeilen je Export prüfe ich Spaltennamen, Datumsformat, Produktnamen der Altbestellungen und den Versandrabatt (siehe nächster Punkt), bevor wir die vollständigen Dateien ziehen.
- **Versandrabatt in Bestellungen:** Ob Shopify bei Gratisversand-Codes den Rabatt in "Discount Amount" und den Versand vor oder nach Rabatt ausweist, ist ohne echte Datei nicht sicher. Das Skript verteilt einen Rabatt nur dann auf die Positionen, wenn die Summen aufgehen, sonst Hinweis.
- **Pfand in Altbestellungen:** Angenommen ist, dass alle Shopify-Preise das Pfand von 0,25 € je Dose enthielten (so stand es im Shop). Gab es Zeiträume ohne Pfand, bitte Bescheid geben.
- **Newsletter-Zeitstempel:** Ohne Admin-API-Abfrage oder Export-App wird kein Kontakt versandfähig (Abschnitt 1). Empfehlung: Token mit `read_customers` für einen einmaligen Abruf.
- **Aktivierungslink bei Massenversand:** Magic Links gelten 15 Minuten. Bei einer Massenmail sind die meisten Links abgelaufen, bevor die Leute sie öffnen. Empfehlung: für den Bulk-Versand eine Variante der Vorlage mit Link auf `/account/konto-aktivieren?email=…` ohne Ablaufhinweis (die Seite schickt dann einen frischen Link). Das betrifft `src/lib/auth/mails.ts` und gehört nicht zu den Importdateien.
- **Rabattlimits je Kunde:** Einlösungen aus Shopify zählen nur, wenn die Bestellung importiert ist und der Code in `discount_codes` existiert.
