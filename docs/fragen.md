# Offene Fragen nach Phase 1

## Antworten vom 21.09.2026

Der Auftraggeber hat alle Empfehlungen bestätigt, mit diesen Abweichungen und Ergänzungen:

- **A1:** Netlify ist per Oberfläche mit dem Repo verbunden. Ein `NETLIFY_AUTH_TOKEN` liegt noch nicht in der Umgebung. Konsequenz: Build-Konfiguration, Redirects, Header und Functions laufen über `netlify.toml` im Repo. Umgebungsvariablen, Passwortschutz und Build-Logs brauchen entweder den Token oder Klicks in der Netlify-Oberfläche (Anleitung in `docs/setup.md`).
- **A2/A3:** Bestehendes Supabase-Projekt `ajscwnbgaijknmdrtihn` (Frankfurt, Postgres 17, angelegt am 21.09.2026, leer). Der Konnektor hat Zugriff. `SUPABASE_ACCESS_TOKEN` ist noch nicht gesetzt, Migrationen laufen bis dahin über den MCP.
- **A4:** Lokaler PostgreSQL 16 für Tests bestätigt (ADR-003).
- **A5:** Zurückgestellt bis zum Go-live. Bis dahin nur Netlify-Domain. Domain liegt bei Strato und bleibt vorerst auf Shopify.
- **A6:** Postfächer bei Google Workspace. Resend ist bereits eingerichtet. Reply-To auf hello@provibe-drinks.de.
- **A7:** Owner: hello@provibe-drinks.de. Super-Admin: mail@paulschoettler.de.
- **A8/A9:** Stripe, Lexware Office und DHL existieren noch nicht, werden angelegt, sobald sie gebraucht werden.
- **B1/B2:** Pfand 0,25 € je Dose ab Go-live aktiv, Nettofüllmenge 330 ml bestätigt.
- **B10:** Das Produkt ist laktosefrei. Umsetzung: "laktosefrei" wird als Eigenschaft auf der PDP geführt. Der Allergenhinweis "Milch" bleibt, weil Molkenprotein ein Milchprotein und damit ein kennzeichnungspflichtiges Allergen nach LMIV Anhang II ist. Nur der Zusatz "einschließlich Laktose" entfällt. Beides steht zur Prüfung in der Rechts-Checkliste (ADR-006).
- **D3:** Alle Newsletter-Kontakte haben laut Auftraggeber zugestimmt, keine Re-Permission. Importiert werden Kontakte mit Shopify-Status "subscribed" als versandfähig, der Shopify-Zeitstempel gilt als Nachweis.
- **E1:** Design-Beispiele kommen im Chat. Storefront-UI bleibt bis dahin gesperrt.
- **F7:** Allowlist für Test-Versand: alle Adressen unter `@provibe-drinks.de` sowie `mail@paulschoettler.de`.

Noch offen: A1 (Token oder Klick-Anleitung), C3 (echte Gewichte), C4 (EANs), D1 (Custom-Pixel-Code), B9 (Etikett-Texte), B13 (LUCID-Nummer), C9 (Test-Export aus Shopify).

---

Jede Frage hat eine Empfehlung. Wenn du nur "ok" sagst, setze ich die Empfehlung um. Antworten trage ich hier nach, Architekturfolgen landen in `docs/decisions.md`. Fragen mit dem Vermerk **jetzt** blockieren Phase 2 oder 3, alle anderen brauche ich erst später.

## A. Infrastruktur und Zugänge

**A1 (jetzt). Netlify-Token.** Kannst du den Personal Access Token wie in `docs/setup.md` beschrieben als `NETLIFY_AUTH_TOKEN` in der Umgebung hinterlegen? Empfehlung: ja, dann lege ich die Site in Phase 2 an. Nenne mir den Team-Slug, falls die Site nicht in dein Standard-Team soll.

**A2 (jetzt). Supabase-Projekt und Plan.** Legst du das Projekt selbst an (Name `provibe`, Frankfurt) oder soll ich es per MCP anlegen? Empfehlung: du legst es an, damit das DB-Passwort bei dir bleibt, ich übernehme alles Weitere. Zum Plan: Für einen Live-Shop empfehle ich den **Pro-Plan** (keine automatische Pausierung, tägliche Backups, mehr Verbindungen). Point-in-Time-Recovery ist ein kostenpflichtiges Add-on auf Pro. Empfehlung: PITR zum Go-live buchen, bis dahin reichen die Plan-Backups plus mein täglicher `pg_dump`-Export. Bitte prüfe die aktuellen Preise selbst im Dashboard, ich nenne bewusst keine Zahlen.

**A3 (jetzt). Supabase Access Token.** Hinterlegst du zusätzlich `SUPABASE_ACCESS_TOKEN` in der Umgebung? Empfehlung: ja, ich brauche ihn für `db push`, Typgenerierung und Backups per CLI. Der MCP allein reicht für Migrationen, nicht für Dumps.

**A4 (jetzt). Lokale Tests ohne Docker.** In dieser Umgebung läuft kein Docker, also auch kein `supabase start`. Empfehlung: Tests gegen einen lokalen PostgreSQL 16 (installiert) mit Stubs für `auth`- und `storage`-Schema, Details in ADR-003. Alternative wäre Supabase Branching (braucht Pro-Plan und GitHub-Integration, erzeugt Preview-Datenbanken pro Branch). Einverstanden mit dem lokalen Postgres?

**A5. Domain und Kanonik.** Aktuell ist `https://www.provibe-drinks.de` kanonisch, Apex leitet um. Empfehlung: dabei bleiben, Netlify bekommt `www` als Primary Domain und leitet Apex per 301 um. Wer verwaltet das DNS (Registrar oder Shopify-DNS)? Das brauche ich für Resend-Einträge und den Go-live.

**A6. Absenderadressen.** Auf der Seite existieren hello@, support@ und partner@provibe-drinks.de. Bei welchem Anbieter liegen die Postfächer (Google Workspace, IONOS, andere)? Empfehlung: Transaktionsmails von `bestellung@provibe-drinks.de` mit Reply-To `hello@`, Newsletter von `newsletter@provibe-drinks.de`. Resend braucht dafür DKIM-Einträge und einen SPF-Include auf der Domain, ohne den vorhandenen SPF des Postfachanbieters zu brechen.

**A7. Admin-Konten.** Wer bekommt den ersten Owner-Account? Empfehlung: `info@abimanufaktur.de` als Owner, `hello@provibe-drinks.de` als Admin, weitere Rollen (Support, Fulfillment) später im Backoffice.

**A8. Stripe-Konto.** Existiert schon ein Stripe-Konto für die CG Projects UG? Empfehlung: falls nein, legst du es jetzt an (Verifizierung dauert), Restricted Key fordere ich in Phase 5 an. PayPal über Stripe muss im Dashboard unter Zahlungsmethoden aktiviert werden, das prüfe ich dann.

**A9. Lexware Office und DHL.** Gibt es bereits ein Lexware-Office-Konto und einen DHL-Geschäftskundenzugang? Empfehlung: beides bis Phase 5 anlegen, Keys erst dann.

## B. Recht, Preise, Pfand

**B1 (jetzt). Pfand.** Der Shop schreibt "Pfand bereits im Preis inkl. (0,25 € pro Dose)". Die Preisangabenverordnung verlangt, das Pfand neben dem Gesamtpreis auszuweisen und nicht einzurechnen. Sind die Dosen DPG-pfandpflichtig (Einwegpfand, DPG-Logo auf der Dose)? Empfehlung: Pfandfeld pro Produkt mit 0,25 € je Dose ab Go-live aktiv, Anzeige "26,10 € inkl. MwSt. zzgl. 2,25 € Pfand" beziehungsweise Dosenpreis "2,65 € + 0,25 € Pfand". Bis du bestätigst, bleibt der Standardwert 0 (laut Briefing Abschnitt 13).

**B2 (jetzt). Grundpreis.** Aktuell statisch 8,03 €/l. Empfehlung: dynamisch je Variante als (Variantenpreis abzüglich Pfand) geteilt durch (Dosen × 0,33 l), also 9er 8,03 €/l bis 48er 8,33 €/l bei gleichbleibendem Pfand. Bitte bestätige die Nettofüllmenge 330 ml je Dose.

**B3. Streichpreise bei Packgrößen.** Die `compare_at`-Preise entsprechen Anzahl × 2,90 € (Dosenpreis im 9er) und sind kein früherer Verkaufspreis. Ein nackter Streichpreis wäre nach PAngV § 11 angreifbar. Empfehlung: statt Streichpreis den Hinweis "Du sparst 5 % gegenüber dem 9er-Pack" beziehungsweise "2,75 € je Dose statt 2,90 €" mit klarer Referenz. Echte Preissenkungen bekommen die 30-Tage-Referenz aus der Preishistorie.

**B4. Streichpreise bei Bundles.** Bundle II zeigt 49,90 → 45,80, Bundle III 63,90 → 57,40. Die Summe der Einzelpreise wäre 47,30 beziehungsweise 67,20. Empfehlung: Bundles zeigen "Einzeln: 67,20 €" (tatsächliche Summe der Komponentenpreise) statt frei gewählter Streichpreise. Bundle I bekommt dieselbe Logik (37,30 €). Einverstanden?

**B5. Lieferzeit.** PDP und Warenkorb sagen "aktuell 6–8 Wochen" (Pre-Sale), die Versandseite "3 bis 5 Werktage". Was gilt beim Go-live? Empfehlung: Lieferzeit als Feld pro Produkt, Standard "3–5 Werktage", im Backoffice änderbar, Text auf der Versandseite dann konsistent.

**B6. Versandkosten.** Deutschland 4,90 € pauschal, frei ab 50 €, richtig? Für die vorbereitete Zone Österreich schlage ich 9,90 € und frei ab 80 € als editierbare Platzhalter vor.

**B7. Steuersätze.** Empfehlung: 19 % auf Eistee (wasserbasiertes Getränk), Shirt, Becher und Pfand. Bitte mit deiner Steuerberatung bestätigen, ich lege den Satz pro Produkt pflegbar an.

**B8. Verkäufer und Lebensmittelunternehmer.** Impressum und Widerruf nennen die CG Projects UG (haftungsbeschränkt), Augsburg. Das Briefing spricht von der "ICT". Wer ist Verkäufer, und wer ist der nach LMIV verantwortliche Lebensmittelunternehmer mit Anschrift für die PDP? Empfehlung: Impressum wie heute übernehmen, LMIV-Angabe mit derselben Firma, bis du etwas anderes sagst.

**B9. LMIV-Lücken.** Auf der PDP fehlen Aufbewahrungshinweis (zum Beispiel "kühl und trocken lagern, nach dem Öffnen gekühlt aufbewahren und zügig verbrauchen"), Herkunftsangabe und Lebensmittelunternehmer. Kannst du mir die Texte vom Dosenetikett schicken (Foto reicht)? Empfehlung: ich übernehme 1:1 vom Etikett, erfinde nichts.

**B10. Widersprüchliche Claims.** Die Messe-Seite wirbt mit "laktosefrei" und "100 % natürlich", die PDP nennt Laktose als Allergen und Sucralose als Süßungsmittel. Empfehlung: im Shop nur die Claims der PDP verwenden ("15 g Protein", "ohne Zucker" beziehungsweise "zuckerfrei", "Eistee mit Protein"), die Messe-Seite unverändert als `noindex`-Seite übernehmen und die beiden Claims in der Rechts-Checkliste markieren. Ist das Produkt tatsächlich laktosefrei (Beta-Lactoglobulin-Isolat kann laktosefrei sein)? Dann gehört das auf die PDP, sonst runter von der Messe-Seite.

**B11. Widerrufsausnahmen.** Die aktuelle Belehrung enthält die Standard-Ausschlüsse (schnell verderbliche Waren, versiegelte Hygieneartikel). Empfehlung: unverändert übernehmen und der Anwältin die Frage stellen, ob geöffnete Dosen unter den Hygiene-Ausschluss fallen sollen. Keine eigene Erfindung meinerseits.

**B12. Verbraucherstreitbeilegung.** Heute: "nicht bereit und nicht verpflichtet". Empfehlung: beibehalten, Hinweis nach § 36 VSBG in Impressum und AGB.

**B13. LUCID-Nummer.** Hast du eine Registrierungsnummer im Verpackungsregister? Empfehlung: Feld ins Impressum, Wert von dir.

## C. Produkte und Daten

**C1. Bundles.** Sind die Founder Bundles ("Limitiertes Set") beim Go-live noch im Sortiment? Empfehlung: ja, modelliert als Bundle mit Komponenten (2 × je Sorte, Cup, Shirt) und Bestandsabzug auf Komponentenebene.

**C2. Shirt und Cup einzeln.** Beide sind heute nur über `/collections/all` erreichbar, nicht in "Produkte". Empfehlung: als eigenständige Produkte behalten (nötig als Bundle-Komponenten), Sichtbarkeit in Kollektionen wie heute.

**C3. Gewichte.** Alle Varianten haben 0 g. Für DHL brauche ich Gewichte. Empfehlung: Platzhalter 0,36 kg je Dose plus Verpackung (9er 0,4 kg, 12er 0,5 kg, 18er 0,7 kg, 24er 0,9 kg, 36er 1,2 kg, 48er 1,5 kg), Shirt 0,2 kg, Cup 0,15 kg. Du korrigierst im Backoffice. Kennst du die echten Werte?

**C4. GTIN/EAN.** Gibt es EANs je Sorte oder je Packgröße? Empfehlung: Feld je Variante, leer starten, Merchant-Center-Feed nutzt dann `identifier_exists=false`.

**C5. Bestände und Pre-Sale.** Ist der Shop noch im Pre-Sale? Aktuelle Bestände bekomme ich aus dem Shopify-Export. Empfehlung: Bestandsführung ab Import aktiv, davor "unbegrenzt".

**C6. SKU-Schema.** Heute nur teilweise gepflegt (WILDBERRY-1 bis -6, PEACH). Empfehlung: einheitliches Schema `PV-WB-09`, `PV-PE-12`, `PV-RL-18`, `PV-MX-24`, `PV-SHIRT-M`, `PV-CUP`, `PV-FB1`, `PV-FB2-M`, `PV-FB3-L`. Alte SKUs bleiben als Legacy-Feld erhalten.

**C7. Produkttitel.** "Founder Bundle l / ll / lll" mit kleinen L. Empfehlung: Anzeige "Founder Bundle I / II / III", Handles unverändert.

**C8. Mixed-Zusammensetzung.** "Zu gleichen Teilen" heißt 9 = 3/3/3 usw. Richtig?

**C9. Shopify-Exporte.** Ich brauche für Phase 9: Produkte (CSV), Kunden (CSV), Bestellungen (CSV), Rabattcodes, Newsletter-Status. Empfehlung: Export erst kurz vor der Migration ziehen, jetzt reicht ein Testexport mit wenigen Zeilen, damit ich die Spalten kenne.

## D. Tracking, Newsletter, Consent

**D1. Custom Pixel.** Im Shop läuft ein Shopify Custom Pixel mit unbekanntem Inhalt. Kannst du mir den Code aus Shopify Admin, Einstellungen, Kundenereignisse schicken? Empfehlung: ich prüfe, ob darin Meta- oder TikTok-IDs stecken, und übernehme die IDs.

**D2. Bestehende Tracking-Konten.** Gibt es schon Meta Pixel, TikTok Pixel, GA4-Property, Google-Ads-Konto? Empfehlung: vorhandene IDs weiterverwenden, sonst neu anlegen, sobald Phase 8 startet.

**D3. Newsletter-Nachweis.** Shopify hat vermutlich Single Opt-in genutzt (war Double Opt-in in Shopify aktiviert?). Empfehlung laut Briefing: nur Kontakte mit Status "subscribed" und Zeitstempel als versandfähig importieren, alle anderen als "nicht abonniert". Falls Shopify kein DOI hatte, empfehle ich vor dem ersten Versand eine einmalige Re-Permission-Mail an die Bestandskontakte. Einverstanden?

**D4. Cookie-Banner heute.** Ich habe kein Consent-Banner im HTML gefunden. War Shopifys eigener Banner aktiv? Für den Nachbau ändert das nichts, ich baue ein eigenes Banner. Nur zur Info, falls Datenschutzberatung fragt.

## E. Design und Frontend

**E1 (jetzt). Beispiele.** Du hast gesagt, du gibst mir Beispiele, bevor ich mit dem kundenseitigen Frontend anfange. Ich warte damit. Empfehlung für die Reihenfolge bis dahin: Projektgerüst, Supabase-Projekt, Datenmodell, Migrationen, Seed, Backoffice-Grundgerüst (nicht kundenseitig). Sobald die Beispiele da sind, suche ich passende BYQ-Systeme und schlage zwei bis drei Richtungen vor.

**E2. Bestehende Optik als Basis?** Der heutige Look (Magenta `#D9306E`, Aubergine `#4A2F39`, Creme `#FBF8EE`, Butter `#F3EDA4`, Jost, Pill-Buttons, kleingeschriebene Produkttitel) ist in den Tokens erfasst. Soll das die Basis bleiben oder ist ein Neuanfang gewünscht? Empfehlung: Farben und Logo behalten, Layout und Komponenten nach deinen Beispielen neu.

**E3. Schriften.** Empfehlung: nur Jost (SIL OFL), selbst gehostet, Outfit, Source Serif 4, Assistant und DM Serif Text entfallen.

**E4. Story-Video.** Das 37-MB-QuickTime-Video auf der PDP transkodiere ich nach MP4 (H.264) und WebM, mit Poster-Bild, autoplay stumm, `prefers-reduced-motion` beachtet. Einverstanden?

## F. Seiten, Redirects, Repo

**F1. Assets im Repo.** 107 MB Originale liegen jetzt in Git (ADR-002). Empfehlung: so lassen, Git LFS erst ab 300 MB.

**F2. Doppelte Seiten.** Empfehlung für Redirects: `/pages/qrcode` → `/pages/shop`, `/pages/qr-code-page-investoren` → `/pages/messe`, `/pages/widerrufsbutton` → `/pages/widerruf-formular`, `/pages/datenschutzerklarung` → `/policies/privacy-policy`, `/policies/terms-of-service` → AGB, `/policies/refund-policy` → Widerruf, `/policies/shipping-policy` → Versand, `/policies/legal-notice` → Impressum. Für `/pages/provibe-paket` und `/pages/provibe-founder-paket` (leere Template-Seiten) schlage ich 301 auf `/collections/aktion` vor. Sind QR-Codes im Umlauf, die auf eine dieser URLs zeigen?

**F3. Messe-Seite.** Investoren-Pitch mit "Pitch Deck anfragen" und "Termin mit Celine". Empfehlung: 1:1 übernehmen, `noindex`, Buttons auf Mailto beziehungsweise Kontaktformular. Oder soll sie weg?

**F4. Blog.** `/blogs/news` ist leer. Empfehlung: Route bleibt, Blog-Modul kommt, Seite ist bis zum ersten Artikel `noindex` mit Hinweistext.

**F5. Kollektionen `all` und `alle-produkte`.** Beide existieren mit unterschiedlichem Inhalt (9 gegen 7 Produkte). Empfehlung: beide behalten, `alle-produkte` als kuratierte Hauptkollektion, `all` als automatische Gesamtliste.

**F6. Sofortkauf.** Heute Shop Pay "oder sofort bezahlen". Empfehlung: Stripe Express Checkout Element (Apple Pay, Google Pay, PayPal, Link) auf PDP und Warenkorb, Rest über den normalen Checkout.

**F7. Rechnungsversand im Testbetrieb.** Empfehlung: Lexware im Testbetrieb nur als Entwurf, PDF-Versand nur an Allowlist-Adressen. Welche Testadressen kommen auf die Allowlist?
