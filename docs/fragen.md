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

Noch offen: C3 (echte Gewichte), C4 (EANs), B9 (Etikett-Texte), B13 (LUCID-Nummer), C9 (Test-Export aus Shopify).

**Nachtrag 21.09.2026, zweite Runde:** Keys für Supabase (Service Role, Access Token) und Netlify liegen lokal in `.env.local` (gitignoriert). Netlify-Site `provibe-shop` ist konfiguriert (Umgebungsvariablen, PR-Deploys aus, Basic Auth aktiv). Die 42 Originalmedien liegen in `product-media/seed/...` und `source-assets/`, die GLBs in `source-assets/3d/`. Owner-Accounts für hello@provibe-drinks.de und mail@paulschoettler.de existieren in Supabase Auth mit Rolle `owner`. Beim Browser-Test der aktuellen Seite wurde ein **Meta Pixel (ID 1372318701489027)** sowie Shopifys eigener Cookie-Banner gefunden, das beantwortet D1/D4 teilweise: der Custom Pixel lädt sehr wahrscheinlich das Meta-Pixel.

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

## G. Startseiten-Design (Prompt vom 21.09.2026)

Analyse und Plan stehen in `docs/design-startseite.md`. Vor dem Bau brauche ich diese Antworten, jede mit Empfehlung:

**G1 (jetzt). Farbwelt der Hero-Hintergründe.** Ciao arbeitet mit dunklen Flächen. Unser Look ist hell (Creme, Butter). Empfehlung: helle Sortenflächen (Wildberry: Pink `#E98AB0` zu Plum `#7E2856` als weicher Verlauf, Raspberry Lime: Magenta `#D9306E` zu Pink-Light `#F7DCEB`, Peach: Peach `#F7CA99` zu Butter `#F3EDA4`), Text in Aubergine, damit die Seite wie PROVIBE aussieht und nicht wie eine Energy-Marke. Einverstanden, oder willst du im Hero bewusst dunkle Flächen wie in der Referenz?

**G2 (jetzt). Startsorte.** Welche Dose zeigt der Hero beim Laden? Empfehlung: Wildberry (erste Karte im Ist, dunkelste Etikettfarbe, stärkster Kontrast), Reihenfolge Wildberry, Raspberry Lime, Peach wie in deinem HTML.

**G3. H1 und Hero-Text.** Der Hero hat keinen Headline-Text mehr außer dem Sortennamen. Für SEO braucht die Seite eine H1 mit "Eistee mit Protein". Empfehlung: kleine Zeile über der Dose "Eistee mit 15 g Protein" als H1 (dezent, Jost 500), Sortenname als große Anzeige darunter. Alternative: H1 visually-hidden, nur für Screenreader und Google.

**G4. Preis im Hero.** Zeigt der Hero den Dosenpreis (2,65 € + 0,25 € Pfand, Grundpreis 8,03 €/l) oder den 9er-Packpreis (26,10 €)? Empfehlung: Dosenpreis mit Pfand und Grundpreis in kleiner Zeile, weil der Button pro Sorte kauft und die PAngV den Grundpreis neben jedem Preis verlangt.

**G5. Position des Warenkorb-Buttons.** Unten links funktioniert mobil, liegt aber nur im rechten Daumen-Randbereich und konkurriert optisch mit dem linken Pfeil. Empfehlung: unten mittig, volle Breite minus 16 px Rand, über der Safe-Area, auf Desktop unten links wie von dir vorgesehen. Beides an identischer Stelle in Hero und Scroll-Sequenz.

**G6. Was legt der Button in den Warenkorb?** Die Sorten werden heute nur als 9er bis 48er verkauft, eine Einzeldose gibt es nicht. Empfehlung: der Button legt den 9er-Pack der aktiven Sorte in den Warenkorb und heißt "9er-Pack in den Warenkorb", der Drawer zeigt dann die anderen Packgrößen. Alternative: Einzeldosen als Produkt freischalten (dann brauchen wir Verpackung und Versandpreis dafür).

**G7. Zutaten-Schritt.** Welche Angaben sollen im Zutaten-Schritt stehen? Empfehlung: Zutatenliste (mit Allergen "Milch" hervorgehoben), drei Badges (15 g Protein, Ohne Zucker, Laktosefrei), Nährwerte je 100 ml als eine Zeile, Link "Alle Details" zur Produktseite. Keine Health-Claims über die bestehenden hinaus.

**G8. Wellen-Stellen.** Ich schlage fünf Stellen vor (`docs/design-startseite.md`, Abschnitt "Sektion 6"). Passt die Auswahl, oder willst du weniger?

**G9. Dosen im Footer.** Welche zwei Sorten? Empfehlung: Wildberry links, Peach rechts (größter Farbkontrast zueinander und zum Logo in Wine).

**G10. Smooth Scrolling.** Lenis auf Desktop wie in beiden Referenzen, auf Mobil natives Scrollen. Einverstanden? Lenis verändert das Scrollgefühl spürbar, manche Nutzer mögen das nicht.

**G11. Ladeanimation.** Ciao zeigt ein Loader-Video, bis die 3D-Szene bereit ist. Empfehlung: kein Loader, stattdessen sofort das Dosen-PNG zeigen und in die 3D-Dose überblenden, sobald das Modell (300 KB) geladen ist. Das ist schneller und robuster für Instagram-Traffic.

**G12. Lizenz und Hosting der 3D-Modelle.** Die Etikett-Texturen enthalten die vollständigen Dosendesigns. Dürfen die optimierten Modelle öffentlich ausgeliefert werden (jeder kann sie herunterladen)? Empfehlung: ja, das ist bei 3D-Shops üblich, aber ich frage vorher.

**Antworten vom 21.09.2026 (G):** G1 bis G3 und G5 bis G12 wie empfohlen. G4: kein Preis im Hero. Bau der Startseite freigegeben.

## H. Nachträge aus dem Bau der Startseite (21.09.2026)

**H1. Pfand in den Founder Bundles.** Die Bundles enthalten sechs Dosen, im Datenmodell steht bei den Bundle-Produkten kein Pfand. Der Warenkorb summiert deshalb das Pfand aus den Komponenten (6 × 0,25 € = 1,50 €) und behandelt den Bundlepreis (zum Beispiel 35,80 €) als Preis inklusive Pfand, so wie bei den Dosen. Der Gesamtbetrag stimmt in jedem Fall, nur die Aufteilung in Warenwert und Pfand hängt daran, und damit auch die 50-Euro-Grenze für den kostenlosen Versand. Empfehlung: so lassen (Pfand ist im Bundlepreis enthalten). Bitte bestätigen.

**H2. Steuersatz.** Alle Produkte stehen auf dem Regelsatz 19 %. Ist der Eistee mit Protein als Lebensmittel mit 7 % einzustufen? Das ist eine Frage an den Steuerberater; bis zur Antwort rechnet der Shop mit 19 %, so wie Shopify heute. Änderung wäre nur ein Datenwert (`products.tax_class`).

**H3. Bestand.** Laut Antwort C5 läuft die Bestandsführung erst ab dem Import. Migration `20260921160000_inventory_unlimited_until_import` schaltet `track_inventory` bis dahin ab, sonst wäre jede Variante mit Bestand 0 im Warenkorb ausverkauft. Keine Aktion nötig, nur zur Kenntnis.

**Antworten vom 17.10.2026 (H und Arbeitsweise):** Stripe und Resend bleiben Mock, Erinnerung vor dem Go-live in `docs/golive.md`. Admin-Zugänge: hello@provibe-drinks.de als Owner, mail@paulschoettler.de als Admin. Alle Unterseiten werden nach den Figma-Screens ohne weitere Rückfrage gebaut. Kundenkonto und Abo: Plan in `docs/konto-und-abo-plan.md`, Konto wird gebaut, Abo wartet auf Freigabe des Plans.

**H4. Gründerin auf der Story-Seite.** Darf Celine mit Vornamen und Foto auf "Über uns" erscheinen? Annahme: ja, Vorname und ein Porträt, sobald eines vorliegt; bis dahin Text ohne Foto.

**H5. Widerruf: Frist, Eingangsbestätigung, Rücksendeadresse.** Das Formular nennt 14 Tage ab Erhalt und verspricht eine Eingangsbestätigung per E-Mail. Welche Rücksendeadresse gilt (Kurt-Viermetz-Straße 1a oder Bei St Ursula 16a)? Annahme: Kurt-Viermetz-Straße 1a wie im Impressum, bis du etwas anderes sagst.

**H6. Postfächer.** Widerruf nennt support@, Kontakt und Impressum hello@. Annahme: beide bleiben und werden abgerufen.

**H7. FAQ und Pre-Sale-Hinweis.** Drei FAQ-Antworten (Versand, Pfand, Protein) sind aus Repo-Daten neu formuliert. Der Pre-Sale-Hinweis (6 bis 8 Wochen) fehlt. Annahme: Pre-Sale ist vorbei, der Hinweis entfällt; FAQ-Texte bitte beim Abnahmedurchgang gegenlesen.

**H8. LUCID.** Die Registrierungsnummer fehlt weiterhin im Impressum. Platzhalter bleibt leer, bis sie vorliegt.

**H9. Fehlerfarbe.** Die Marke hat kein Rot. Fehler zeigen wir mit Magenta-Rahmen, Berry-Text und Icon. Annahme: so lassen, kein Signalrot.

**H10. Checkout-Texte.** Eigene Formulierungen wie "Wohin geht dein Vibe?", "Wie willst du zahlen?", "Schön, dass du da bist.", "Wir packen schon …" sind Vorschläge; bitte beim Abnahmedurchgang gegenlesen. Zustellfenster wird aus Bestelldatum plus 3 bis 5 Werktage dynamisch berechnet.

**H11. Hauptpreis in Produktkarten.** Verkauft werden nur Packs ab 9 Dosen. Entscheidung (konservativ nach Preisangabenverordnung): Hauptpreis ist der Packpreis "ab 26,10 €" mit "9 Dosen", darunter "2,65 € je Dose · zzgl. 0,25 € Pfand je Dose · 8,03 €/l". Der alte Shop zeigte nur 2,65 €; wenn du das zurück willst, bitte mit deinem Anwalt klären.

**H12. Einzelpreis Founder Bundle III.** Aus den Komponentenpreisen ergibt sich 67,20 € (6 × 2,90 € + 19,90 € + 29,90 €), Shopify zeigte 63,90 €. Entscheidung: Wert aus der Datenbank berechnen, keine Handzahl.

**H13. Shirt-Größen und Produktfotos.** Im Shopify-Snapshot gibt es für das Shirt nur S, M und L; XL wird nicht angeboten. Für Shirt, Cup und weitere Galeriebilder fehlen Fotos, bis dahin Platzhalterkarten. Lagerhinweis (LMIV) fehlt in den Daten: Annahme "Kühl und trocken lagern, vor Sonnenlicht schützen, gekühlt servieren" bis zur Freigabe.

**H14. Lagereinheit.** Entscheidung: Die Dose ist die Lagereinheit, Packvarianten sind Vielfache (unit_count), Bundles buchen Komponenten ab. So ist das Datenmodell schon angelegt.

**H15. Zwei-Faktor-Wiederherstellung.** "Code erneut senden" gibt es bei Authenticator-Apps nicht. Entscheidung: Wiederherstellungscodes beim Einrichten anzeigen und im Backoffice "Zwei-Faktor zurücksetzen" durch einen Owner.

**H16. Zahl- und Versandstatus.** Entscheidung: beide werden aus dem Bestellstatus und den Zahlungs- und Sendungsdaten abgeleitet, keine eigenen Felder.

**H17. Streichpreis-Art.** Der Shop zeigt keine Streichpreise aus Packgrößen-Vergleichen (B3), Bundles zeigen "Einzeln: X €" (B4). Frühere Preise (30-Tage-Regel nach PAngV § 11) nur mit automatischem Nachweis aus price_history; bis der Anwalt das freigibt, bleibt die Art "former_price" im Backoffice ausgeschaltet.

**H18. Lead-Status.** Das Enum kennt `qualified`, der Entwurf zeigt "Angebot". Entscheidung: Anzeige "Qualifiziert" statt Umbenennen des Enums; ein zusätzlicher Status "Angebot" kommt nur, wenn ihr ihn im Vertrieb wirklich nutzt.

**H19. Rollenrechte.** Entscheidung: Benutzerverwaltung nur für Owner, Erstattungen für Owner und Admin, nicht für Fulfillment und Support. Wird in der Backoffice-Migration als Policy-Anpassung umgesetzt.

**H20. Bewertungsanfrage ohne Werbeeinwilligung (§ 7 Abs. 3 UWG).** Rechtsfrage, nicht geraten: Die Automation "Bewertungsanfrage" bleibt ausgeschaltet und sendet nur an Kontakte mit Werbeeinwilligung, bis dein Anwalt die Bestandskundenausnahme freigibt.

**H21. Rechnungsnummern.** Laut Briefing vergibt Lexware die Rechnungsnummern, der Shop keinen eigenen Kreis. So ist der Checkout gebaut (orders.invoice_number wird von Lexware gefüllt). Bis der Lexware-Key da ist, bleiben Rechnungen Entwürfe ohne Nummer.

## I. Rechtstexte (17.10.2026)

Entstanden bei der Anpassung der fünf Rechtstexte (Gegenüberstellung in `docs/rechtstexte-aenderungen.md`, Prüfliste in `docs/legal-checklist.md`, Entwürfe Version 2 in `supabase/migrations/20261017105000_legal_texts_v2_draft.sql`). Das sind Rechtsfragen: Ich gebe jeweils eine Empfehlung, entscheiden sollten du und dein Anwalt. Nichts davon ist geraten umgesetzt; wo der Entwurf eine Annahme enthält, steht sie dabei.

**I1 (vor Go-live). Pfand im Packpreis.** Produktseite, Bundle-Karten, Warenkorb- und Bestellzeilen zeigen den Packpreis mit Pfand ("26,10 € inkl. 2,25 € Pfand"), die Sortenkarten dagegen "2,65 € je Dose zzgl. 0,25 € Pfand". Die Preisangabenverordnung verlangt nach meinem Verständnis, das Pfand neben dem Preis anzugeben, ohne mit ihm einen Gesamtbetrag zu bilden. Empfehlung: überall den Preis ohne Pfand zeigen ("23,85 € zzgl. 2,25 € Pfand"), Pfand nur im Gesamtbetrag der Bestellung addieren; das betrifft auch H1 (Bundles) und H11 (Kartenpreis). Technisch ist das eine Anzeigeänderung, die Datenbank speichert schon getrennt. Der Text in AGB-5 ist neutral formuliert und passt zu beiden Varianten.

**I2 (vor Go-live). Rückgabe der Pfanddosen.** Welche Rücknahmepflicht hat ein Online-Händler für pfandpflichtige Einweggetränkeverpackungen, und was müssen wir Kunden dazu sagen? Wer meldet die Dosen im DPG-System an (Hersteller oder ihr als Erstinverkehrbringer)? Empfehlung: mit Anwalt oder DPG-Systemberatung klären, danach einen Satz zur Rückgabe in Kundeninformation 5.5 der AGB ergänzen. Ich formuliere bewusst nichts vor.

**I3. Vertragsschluss bei gescheiterter Zahlung.** Laut AGB entsteht der Vertrag mit dem Klick auf "Zahlungspflichtig bestellen". Der Shop legt die Bestellung aber erst an, wenn die Zahlung bestätigt ist; scheitert PayPal, Klarna oder 3-D Secure, gibt es keine Bestellung und keine Bestätigung. Empfehlung: Anwalt entscheidet, ob § 2 Abs. 3 einen Satz für diesen Fall braucht oder ob der Vertragsschluss an die Zahlungsbestätigung geknüpft wird. Bis dahin bleibt die Händlerbund-Logik.

**I4. Händlerbund-Hinweis am Ende der AGB.** Der Text "Die Händlerbund Management AG garantiert für die Rechtssicherheit der Texte" stimmt nach unseren Änderungen nicht mehr ohne Weiteres. Empfehlung: prüfen, ob die Mitgliedschaft noch besteht; wenn ja, die Texte im Händlerbund-Portal für "eigener Shop, Zahlung über Stripe mit PayPal und Klarna" neu erzeugen und mit dem Entwurf abgleichen; wenn nein, den Hinweis streichen.

**I5 (vor Go-live). Widerrufsbelehrung und Widerrufsfunktion seit 19.06.2026.** Die elektronische Widerrufsfunktion ist gebaut (`/pages/widerruf-formular`, Eingangsbestätigung per E-Mail). Der Entwurf ergänzt den optionalen Baustein der Muster-Belehrung für Online-Widerrufe (WI-1). Ich kann nicht verlässlich sagen, ob der Gesetzgeber mit der Neuregelung auch das Muster, die Beschriftung der Funktion oder den Inhalt der Bestätigung genauer vorgibt. Empfehlung: aktuelle Fassung vom Anwalt oder Händlerbund einsetzen lassen und das Formular dagegen prüfen.

**I6. Rücksendeadresse.** Der Entwurf streicht "Bei St Ursula 16a" und nennt nur noch die Anschrift oben in der Belehrung (Kurt-Viermetz-Straße 1a, Annahme aus H5). Empfehlung: so lassen, außer Bei St Ursula 16a ist ein Lager, das Rücksendungen weiter annimmt.

**I7. Widerrufsausnahmen für Lebensmittel.** Die Ausschlussgründe sind unverändert übernommen (B11), darunter "schnell verderbliche Waren" und "versiegelte Hygieneartikel". Ob sie für Eistee in Dosen greifen, ist zweifelhaft; eine Belehrung mit Ausnahmen, die nie passen, kann irreführen. Empfehlung: Anwalt entscheidet; ich ergänze oder streiche nichts selbst.

**I8. Postfach in der Widerrufsbelehrung.** Belehrung und Formular nennen support@provibe-drinks.de (H6). Empfehlung: nur dabei bleiben, wenn das Postfach sicher täglich abgerufen wird; sonst überall hello@.

**I9. Datenschutzerklärung als Ganzes.** Der Entwurf ersetzt Shopify und ergänzt Pflichtangaben, bleibt aber Shopifys generische Vorlage (Formulierungen zu Empfehlungen, Affiliates, Unternehmensgruppe, "SMS oder Post"). Dazu zwei Detailfragen: Ein Datenschutzbeauftragter ist nach meiner Einschätzung nicht nötig (weniger als 20 Personen verarbeiten ständig Daten), und die Aufbewahrungsfristen stehen im Text nur als "bis zu zehn Jahre", weil für Buchungsbelege seit 2025 nach meinem Kenntnisstand acht Jahre gelten. Empfehlung: zum Go-live den Entwurf nehmen, mittelfristig durch eine geprüfte DSGVO-Vorlage ersetzen (zum Beispiel aus dem Händlerbund-Paket), Fristen mit der Steuerberatung festlegen.

**I10 (vor Go-live). Dienstleister, Verträge, Drittländer.** Die Datenschutzerklärung nennt Netlify, Supabase, Stripe Payments Europe, PayPal (Europe), Klarna Bank AB, Resend, Haufe-Lexware und DHL Paket aus allgemeiner Kenntnis, nicht aus euren Verträgen, und behauptet abgeschlossene Auftragsverarbeitungsverträge. Zu klären: Vertragspartner je Dienst, AVV abgeschlossen (meist per Klick im Dashboard), Rolle von Stripe, PayPal und Klarna (Auftragsverarbeiter oder eigene Verantwortung), Grundlage für US-Übermittlungen je Anbieter (Data Privacy Framework oder Standardvertragsklauseln), Region der Netlify Functions (Standard ist nach meinem Wissen eine US-Region, eine EU-Region ist eventuell einstellbar), Hinweispflichten von Klarna im Shop. Empfehlung: das erledige ich mit dir, sobald die Konten existieren; der Text wird danach angeglichen.

**I11. E-Mail oder Telefon an DHL.** Die DHL-Schnittstelle kann E-Mail und Telefon für die Paketankündigung übergeben. Ob das ohne Einwilligung zulässig ist, wird unterschiedlich beurteilt. Empfehlung: zum Start nicht übermitteln (so steht es im Entwurf), später ein optionales, nicht vorangekreuztes Häkchen "DHL darf mich über die Zustellung informieren".

**I12. Öffnungs- und Klickmessung im Newsletter.** Briefing 8 wünscht Kennzahlen (Öffnungen, Klicks). Das ist eine Auswertung des Leseverhaltens und braucht nach meiner Einschätzung einen Hinweis in Einwilligungstext und Datenschutzerklärung, eventuell eine eigene Einwilligung. Empfehlung: Messung in Resend aus, bis der Anwalt den Einwilligungstext (`CONSENT_TEXT` in `src/lib/newsletter/consent.ts`) und einen Absatz für die Datenschutzerklärung freigibt.

**I13. Importierte Newsletter-Kontakte.** Laut D3 gelten Shopify-Kontakte mit Status "subscribed" als versandfähig, Nachweis ist der Shopify-Zeitstempel. Shopify hat vermutlich Single Opt-in genutzt; dann fehlt der Nachweis, dass die Adresse wirklich dem Anmeldenden gehört. Der Entwurf beschreibt den Import offen ("übernehmen den dort gespeicherten Anmeldestatus und Zeitpunkt"). Empfehlung: Anwalt; im Zweifel eine einmalige Bestätigungsmail an die importierten Kontakte vor dem ersten Newsletter.

**I14. Bewertungsanfrage (H20).** Bleibt ausgeschaltet. Erst wenn die Bestandskundenausnahme freigegeben ist, kommt ein Absatz in die Datenschutzerklärung. Keine neue Frage, nur der Verweis.

**I15. Rabattcodes und Preisermäßigung.** Die Announcement-Bar wirbt mit "10 % Rabatt mit dem Code PRESALE10". Ob eine solche allgemein beworbene Code-Aktion als Preisermäßigung mit Angabe des niedrigsten Preises der letzten 30 Tage gilt, ist umstritten. Empfehlung: Anwalt; bis dahin keine Streichpreise zu Code-Aktionen, Rabatt wie gebaut nur im Warenkorb und Checkout ausweisen.

**I16. Bundle-Vergleich "Einzeln: X €".** Bundles zeigen die Summe der aktuellen Einzelpreise als Vergleich (H12, H17), keinen früheren Preis. Empfehlung: vom Anwalt bestätigen lassen, dass das kein Streichpreis im Sinne der 30-Tage-Regel ist; die Darstellung ohne Durchstreichen beibehalten.

**I17 (vor Abo-Start). Abo-Recht.** Erstens: Der Plan sieht für `/abo-kuendigen` einen Bestätigungslink per E-Mail vor; nach meinem Verständnis muss die Kündigung schon mit "jetzt kündigen" abgegeben sein, die Mail ist nur Bestätigung. Empfehlung: so bauen. Zweitens: AGB § 3 unverändert lassen und die Kündigung "jederzeit zum nächsten Liefertermin" im Angebot regeln (Variante A) oder § 3 neu fassen (Variante B, Text in `docs/rechtstexte-aenderungen.md`, ABO-1). Empfehlung: A. Drittens: Passt der Spiegelstrich "regelmäßige Lieferung über einen festgelegten Zeitraum" in der Widerrufsbelehrung auf ein Abo mit unbestimmter Laufzeit? Viertens: Preisanpassung bei laufenden Abos braucht entweder eine wirksame Klausel oder Kündigung und neues Angebot; ich formuliere keine Klausel.

**I18. Impressum.** Die Angabe der BLM als Aufsichtsbehörde für audiovisuelle Mediendienste ist unverändert übernommen. Empfehlung: Anwalt prüft, ob sie noch nötig ist, und ob mit dem geplanten Blog ein inhaltlich Verantwortlicher nach § 18 Abs. 2 Medienstaatsvertrag genannt werden muss.

**H22. Pfand getrennt vom Preis (Befund I1).** § 7 PAngV: Pfand ist neben dem Gesamtpreis anzugeben, ein Gesamtbetrag ist nicht zu bilden. Entscheidung: Alle Preisanzeigen in Karten, Produktseiten, Warenkorb und Checkout zeigen den Preis ohne Pfand als Hauptpreis und das Pfand getrennt ("zzgl. 2,25 € Pfand"), die Zahlsumme im Checkout weist das Pfand als eigene Zeile aus. Die Datenbank speichert weiterhin price_cents inklusive Pfand (Shopify-Stand), die Anzeige rechnet es heraus. Umsetzung in der nächsten Storefront-Welle; bitte vom Anwalt bestätigen lassen.

**H23. Kündigungsbutton ohne Bestätigungslink (Befund I17).** § 312k BGB verlangt, dass die Kündigung mit dem Klick auf die Bestätigungsschaltfläche wirksam erklärt ist. Entscheidung: `/abo-kuendigen` erfasst Name, E-Mail und optional Abo-Nummer, der Klick "Jetzt kündigen" erklärt die Kündigung sofort, der Shop zeigt die Bestätigung mit Datum und Uhrzeit an und schickt sie unverzüglich per E-Mail. Kein Bestätigungslink vorab. Der Abo-Plan ist entsprechend angepasst.

**H24. Bestand je Dose für Packvarianten (Folge von H14).** Heute führt jede Packvariante (9 bis 48 Dosen) ihren eigenen Bestand, nur Bundles buchen Komponenten ab. Entscheidung: Je Sorte entsteht eine inaktive Einzeldosen-Variante als Lagereinheit, jede Packvariante wird als Bundle aus unit_count Dosen modelliert (Mixed: je ein Drittel je Sorte). Reservierung und Abbuchung laufen dann immer in Dosen. Umsetzung als Migration in der nächsten Welle, Bestandszahlen bleiben 0 bis zum Import.

**H25. Abo-Details aus den Figma-Entwürfen (Seite 07).** Entscheidungen: Abo-Nummer als eigenes Feld `subscriptions.number` im Format ABO-1001 fortlaufend. Zahlarten im Abo zunächst Karte, Apple Pay, Google Pay und PayPal (falls freigeschaltet), SEPA später, Klarna nicht. Statistik-Anbieter im Consent: keiner, bis du einen nennst (Google Analytics nur als Platzhalter im Entwurf). Pause höchstens 6 Monate. Der dezente Link "Lieber erst mal Pause?" im Kündigen-Dialog bleibt, die Kündigung selbst wird dadurch nicht erschwert. Die Kündigung ohne Login gilt mit dem Klick (H23), der Zustand "Link gesendet" aus dem Entwurf entfällt im Code.

**H26. Tracking-IDs.** Consent-Banner und Tracking-Schicht sind gebaut, aber keine ID ist aktiv. Annahme: Der Meta-Pixel 1372318701489027 aus der Analyse wird genutzt, sobald du es bestätigst (D1, D2); Google Ads und TikTok erst mit euren IDs. Eintragen im Backoffice unter Einstellungen, Tracking. Cookie `pv_consent` gilt 12 Monate und enthält keine personenbezogenen Daten (steht in der Datenschutzerklärung Version 2 als offener Marker, wird nachgetragen).

**H27. Produkttext Peach nennt Schwarztee.** Der Shopify-Text zu Peach spricht von der "feinen Note von Schwarztee", die Zutatenliste aller drei Sorten enthält aber keinen Tee (Wasser, Molkenprotein, Fruchtsaft, Aromen, färbendes Lebensmittel, Sucralose). Ein Geschmackshinweis ohne die Zutat kann als irreführend gelten (LMIV Art. 7). Empfehlung: Satz auf "mit einer feinen Eistee-Note" ändern oder bestätigen, dass Tee enthalten ist und die Zutatenliste ergänzt wird. Ich lasse den Text bis zu deiner Antwort unverändert, weil Produkttexte wortgleich vom Shopify-Shop übernommen sind.

**H28. Abo-Annahmen aus dem Bau.** Erstens: Rabattcodes gelten in der ersten Bestellung auch auf die Abo-Position (wie bei Shopify), in Folgelieferungen nicht; der Abo-Rabatt selbst bleibt. Zweitens: Eine Kündigung ohne Login ohne Abo-Nummer gilt für alle offenen Abos der angegebenen E-Mail-Adresse; mit Abo-Nummer nur für dieses. Drittens: Eine unbekannte E-Mail-Adresse bekommt dieselbe Bestätigungsseite, intern wird der Fall als ungeklärt protokolliert, damit niemand prüfen kann, ob ein Abo existiert. Viertens: Fehlt am Liefertag Bestand, verschiebt sich die Lieferung um einen Tag; eine Meldung ans Backoffice baue ich nach (Bestand-Modul). Die Preisankündigung mit vier Wochen Vorlauf ist gebaut, aber ohne Klausel in AGB oder Mail (siehe I17, viertens); bis zur anwaltlichen Antwort nutzen wir sie nicht.

**H29. Bewertungen, Annahmen aus dem Bau.** Bewerten geht nur über den Link aus der Bewertungsanfrage (60 Tage gültig ab Versand), je Bestellung und Produkt eine Bewertung, Bundles als Ganzes. Teilerstattete, aber zugestellte Bestellungen sind bewertbar, stornierte und voll erstattete nicht. Der angezeigte Name ist Vorname plus Initiale aus der Rechnungsadresse, sonst aus der Lieferadresse, von der Kundin änderbar. Jede Änderung einer Bewertung setzt sie zurück auf "in Prüfung". Der Echtheitshinweis (UWG Anhang Nr. 23b) steht am Formular und an den Bewertungen; bitte vom Anwalt bestätigen lassen. Die Bewertungsanfrage-Automation bleibt laut H20 ausgeschaltet, bis du sie einschaltest. Die Freigabe im Backoffice darf nicht nach Sternen filtern; abgelehnt wird nur mit protokolliertem Grund.
