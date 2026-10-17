# Rechtstexte: Gegenüberstellung alt gegen neu (Version 2, Entwurf)

Stand: 17.10.2026. Status: **Entwurf zur Freigabe**, nichts davon ist veröffentlicht.

Ich bin kein Anwalt, und dieses Dokument ist keine Rechtsberatung. Es bereitet die Anpassung der fünf Shopify-Texte an den neuen Shop so vor, dass du und dein Anwalt jede Änderung einzeln prüfen und abhaken könnt. Wo ich unsicher bin, steht das ausdrücklich da, und die Frage landet in Abschnitt 9 sowie in `docs/fragen.md`, Abschnitt I.

## 0. So liest du dieses Dokument

- **Alt** ist Version 1 in der Datenbank, also der wortgleiche Shopify-Text vom 21.09.2026 (Quellen: `docs/quelltexte/pages_*.md`, `docs/quelltexte/policies_privacy_policy.md`, Seed `supabase/migrations/20260921130000_seed_shopify_snapshot_part1.sql` und `..._part2.sql`). Version 1 bleibt unverändert und ist bis zur Freigabe die gültige Fassung.
- **Neu** ist Version 2 aus `supabase/migrations/20261017105000_legal_texts_v2_draft.sql` (Status `draft`, `effective_from` und `published_at` leer). Dort steht jeder Text vollständig als HTML mit H2-Überschriften.
- Aufgeführt sind nur Stellen, die sich ändern. Alles, was hier nicht steht, ist wortgleich übernommen.
- Jede Änderung hat eine Kennung (IM, AGB, WI, VS, DS, ABO) und ein Kästchen für die Freigabe.
- **Redaktionell** heißt: nur Markup oder Tippfehler, kein inhaltlicher Eingriff. Diese Punkte sind je Text gesammelt.
- **[OFFEN]** im Text markiert eine Lücke, die vor der Veröffentlichung gefüllt werden muss. Version 2 enthält genau einen solchen Marker (DS-15, Name und Dauer des Consent-Cookies).

### Übersicht

| Text                 | Inhaltliche Änderungen | Redaktionell | Hängt ab von                                    |
| -------------------- | ---------------------- | ------------ | ----------------------------------------------- |
| Impressum            | 2 (IM-1, IM-2)         | 2            | B13/H8 (LUCID)                                  |
| AGB                  | 5 (AGB-1 bis AGB-5)    | 4            | I1, I3, I4                                      |
| Widerrufsbelehrung   | 2 (WI-1, WI-2)         | 2            | H5, I5                                          |
| Versand              | 5 (VS-1 bis VS-5)      | 0            | H7/B5 (Pre-Sale), I10                           |
| Datenschutzerklärung | 22 (DS-1 bis DS-22)    | 4            | Consent-Banner, AVVs, I9 bis I13                |
| Abo (erst mit Start) | 5 (ABO-1 bis ABO-5)    | 0            | Abo-Freigabe, I17; **nicht Teil von Version 2** |

### Wann welcher Text live gehen kann

- Impressum, AGB, Widerrufsbelehrung, Versand: zum Go-live (DNS-Umzug), weil sie den neuen Checkout beschreiben. Version 1 beschreibt noch den Shopify-Checkout; das ist unkritisch, solange die neue Seite hinter dem Passwortschutz liegt.
- Datenschutzerklärung: zum Go-live, aber nur, wenn bis dahin Consent-Banner, Footer-Link "Cookie-Einstellungen" und die Verträge zur Auftragsverarbeitung stehen. Ist ein Tracking-Dienst (Meta, Google, TikTok) beim Go-live noch nicht aktiv, streichen wir dessen Absatz vor der Freigabe.
- Abo-Abschnitte (Abschnitt 6): erst als Version 3, wenn das Abo verkauft wird.

---

## 1. Impressum

Pfad `/pages/impressum`. Keine Shopify-Nennung im Text.

### IM-1. Zeile "Email Marketing" entfällt

| Alt                                                            | Neu      |
| -------------------------------------------------------------- | -------- |
| (nach "E-Mail: hello@provibe-drinks.de") <br>`Email Marketing` | entfällt |

**Begründung:** Die Zeile hat keinen Inhalt und keinen Link. Sie ist sehr wahrscheinlich ein Rest aus dem Shopify-Editor (Shopify Email). Im Impressum wirkt sie wie eine unvollständige Angabe.

- [ ] freigegeben

### IM-2. LUCID-Registrierungsnummer (Verpackungsregister)

| Alt   | Neu                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| fehlt | eigener Abschnitt "Verpackungsregister": `Registrierungsnummer im Verpackungsregister LUCID: Registrierungsnummer folgt` (Platzhalter bis B13/H8) |

**Begründung:** Briefing Abschnitt 5 verlangt ein Feld für die LUCID-Nummer. Die Zeile steht bewusst **nicht** in `body_html`: Die Seite `src/app/pages/impressum/page.tsx` hängt sie schon heute als Abschnitt aus `shop_settings.shop.legal_entity.lucid_number` an. Stünde sie zusätzlich im Text, erschiene sie doppelt. Sobald du die Nummer lieferst, trage ich sie in `shop_settings` ein; der Text muss dafür nicht neu versioniert werden. Ob die Nummer im Impressum stehen muss, ist rechtlich nicht vorgeschrieben (Verpackungsgesetz verlangt Registrierung, nicht die Angabe); sie schadet aber nicht und schafft Vertrauen. Vor dem Verkauf brauchst du die Registrierung in jedem Fall (Checkliste, Punkt Verpackungsgesetz).

- [ ] freigegeben

### Redaktionell (Impressum)

1. Die beiden Zeilen "Impressum" am Anfang (doppelter Seitentitel) entfallen; die Seite hat die H1 schon.
2. Die Abschnittsüberschriften Anbieter, Kontakt, Register und Umsatzsteuer, Aufsichtsbehörde, Verbraucherstreitbeilegung stehen jetzt als H2 im Text. Die Seite zeigt sie heute schon (automatisch eingefügt in `src/lib/content/html.ts`), am Erscheinungsbild ändert sich nichts.

**Unverändert und zur Prüfung markiert:** Angabe der BLM als Aufsichtsbehörde für audiovisuelle Mediendienste, Hinweis zur Verbraucherstreitbeilegung (B12), "vertr. d. d. Geschäftsführer". Siehe Frage I18.

---

## 2. Allgemeine Geschäftsbedingungen und Kundeninformationen

Pfad `/pages/allgemeine-geschaftsbedingungen`. Erkennbar Händlerbund-Muster; die neuen Formulierungen bleiben in dessen Stil. Keine ausdrückliche Shopify-Nennung, aber der Bestellablauf beschreibt Zahlarten, die es nicht mehr gibt (Amazon Pay, Sofort, PayPal Express/Plus).

### AGB-1. § 2 Abs. 3, Weg zur Bestellübersicht

**Alt:**

> Nach Anklicken der Schaltfläche "Kasse" oder "Weiter zur Bestellung" (oder ähnliche Bezeichnung) und der Eingabe der persönlichen Daten sowie der Zahlungs- und Versandbedingungen werden Ihnen abschließend die Bestelldaten als Bestellübersicht angezeigt.

**Neu:**

> Nach Anklicken der Schaltfläche "Zur Kasse" und der Eingabe der persönlichen Daten (E-Mail-Adresse, Lieferanschrift und gegebenenfalls abweichende Rechnungsanschrift) sowie der Auswahl der Versand- und Zahlungsart werden Ihnen abschließend die Bestelldaten als Bestellübersicht angezeigt. Eine Bestellung ist auch ohne Kundenkonto möglich.

**Begründung:** Beschreibt den neuen Checkout in zwei Schritten: Warenkorb oder Drawer mit Button "Zur Kasse" (`src/components/cart/CartDrawer.tsx`), Schritt 1 E-Mail, Adresse, Versandart (`src/components/checkout/DetailsForm.tsx`), Schritt 2 Zahlart und Bestellübersicht "Bestellung prüfen" (`src/app/checkout/(kasse)/zahlung/page.tsx`). Gastbestellung ist laut Briefing der Standard, ein Konto freiwillig.

- [ ] freigegeben

### AGB-2. § 2 Abs. 3, Sofortzahl-Systeme ersetzt durch Weiterleitung nach dem Bestellbutton

**Alt** (zwei Absätze, zwischen Bestellübersicht und "Vor Absenden der Bestellung"):

> Soweit Sie als Zahlungsart ein Sofortzahl-System (z.B. PayPal (Express/Plus/Checkout), Amazon Pay, Sofort) nutzen, werden Sie entweder auf die Bestellübersichtsseite in unserem Online-Shop geführt oder auf die Internetseite des Anbieters des Sofortzahl-Systems weitergeleitet.
>
> Erfolgt eine Weiterleitung zu dem jeweiligen Sofortzahl-System, nehmen Sie dort die entsprechende Auswahl bzw. Eingabe Ihrer Daten vor. Abschließend werden Ihnen auf der Internetseite des Anbieters des Sofortzahl-Systems oder nachdem Sie zurück in unseren Online-Shop geleitet wurden, die Bestelldaten als Bestellübersicht angezeigt.

**Neu** (ein Absatz, jetzt **nach** dem Absatz zum Vertragsschluss, weil die Weiterleitung erst nach dem Klick passiert):

> Soweit Sie als Zahlungsart PayPal oder Klarna wählen, werden Sie nach dem Absenden der Bestellung auf die Internetseite des jeweiligen Anbieters weitergeleitet, um die Zahlung dort freizugeben. Gleiches gilt, soweit bei Zahlung per Karte, Apple Pay oder Google Pay eine zusätzliche Bestätigung (z.B. 3-D Secure) erforderlich ist. Anschließend werden Sie in unseren Online-Shop zurückgeleitet.

**Begründung:** Amazon Pay und Sofort gibt es nicht mehr, Shop Pay entfällt. Im neuen Checkout sieht der Kunde die vollständige Bestellübersicht immer in unserem Shop, unmittelbar vor dem Button. PayPal und Klarna laufen über Stripe und leiten erst nach dem Klick zum Anbieter weiter (`src/lib/checkout/types.ts`, `PAYMENT_METHODS`: "Du wirst zu PayPal weitergeleitet"); bei Karten kann die Bank eine 3-D-Secure-Bestätigung verlangen (`src/app/checkout/(kasse)/zahlung/bestaetigen/page.tsx`). Offen ist, was rechtlich gilt, wenn die Zahlung nach dem Klick scheitert (Frage I3).

- [ ] freigegeben

### AGB-3. § 2 Abs. 3, Beschriftung des Bestellbuttons

**Alt:**

> Mit dem Absenden der Bestellung über die entsprechende Schaltfläche ("zahlungspflichtig bestellen", "kaufen" / "jetzt kaufen", "kostenpflichtig bestellen", "bezahlen" / "jetzt bezahlen" oder ähnliche Bezeichnung) erklären Sie rechtsverbindlich die Annahme des Angebotes, wodurch der Vertrag zustande kommt.

**Neu:**

> Mit dem Absenden der Bestellung über die Schaltfläche "Zahlungspflichtig bestellen" erklären Sie rechtsverbindlich die Annahme des Angebotes, wodurch der Vertrag zustande kommt.

**Begründung:** Der Button heißt im Code genau so (`src/components/checkout/PaymentForm.tsx`). Eine Liste möglicher Beschriftungen ist nicht mehr nötig. Die Rechtswirkung (Annahme mit dem Klick) bleibt wortgleich.

- [ ] freigegeben

### AGB-4. Kundeninformationen 3.2, Vertragstextspeicherung

**Alt:**

> 3.2. Der vollständige Vertragstext wird von uns nicht gespeichert. Vor Absenden der Bestellung über das Online - Warenkorbsystem können die Vertragsdaten über die Druckfunktion des Browsers ausgedruckt oder elektronisch gesichert werden. Nach Zugang der Bestellung bei uns werden die Bestelldaten, die gesetzlich vorgeschriebenen Informationen bei Fernabsatzverträgen und die Allgemeinen Geschäftsbedingungen nochmals per E-Mail an Sie übersandt.

**Neu:**

> 3.2. Der Vertragstext wird von uns gespeichert, ist Ihnen nach Vertragsschluss jedoch nicht über das Internet zugänglich. Soweit Sie ein Kundenkonto angelegt haben, können Sie die Bestelldaten dort einsehen. Vor Absenden der Bestellung über das Online-Warenkorbsystem können die Vertragsdaten über die Druckfunktion des Browsers ausgedruckt oder elektronisch gesichert werden. Nach Zugang der Bestellung bei uns werden die Bestelldaten, die gesetzlich vorgeschriebenen Informationen bei Fernabsatzverträgen und die Allgemeinen Geschäftsbedingungen nochmals per E-Mail an Sie übersandt.

**Begründung:** Die Angabe muss zum tatsächlichen Betrieb passen (Kunde ist zu informieren, ob der Vertragstext gespeichert wird und ob er zugänglich ist). Der neue Shop speichert jede Bestellung mit Positionen und Preisen (`orders`, `order_items`) und die IDs der bei Bestellung gültigen AGB- und Widerrufsfassung (`orders.legal_versions`, `src/lib/checkout/legal.ts`). Kunden mit Konto sehen ihre Bestellungen unter `/account/bestellungen`; die AGB-Fassung ist dort nicht abrufbar, Gäste haben keinen Zugang. Der letzte Satz bleibt wahr: Die Bestellbestätigung enthält AGB und Widerrufsbelehrung in der Fassung zum Bestellzeitpunkt (`src/lib/checkout/emails.ts`).

- [ ] freigegeben

### AGB-5. Kundeninformationen 5.5 (neu), Pfand und Grundpreis

**Alt:** fehlt. Die Produktbeschreibungen sagten "Pfand bereits im Preis inkl. (0,25 € pro Dose)".

**Neu:**

> 5.5. Für Getränke in pfandpflichtigen Einweggetränkeverpackungen fällt ein Pfand in der im jeweiligen Angebot angegebenen Höhe an (derzeit 0,25 € je Dose). Das Pfand wird gesondert ausgewiesen und in der Bestellübersicht als eigene Position aufgeführt. Der Grundpreis wird ohne Pfand berechnet.

**Begründung:** Pfand ist ab Go-live aktiv (Antwort B1). Der Shop weist es in Warenkorb, Bestellübersicht, Bestellmail und Rechnung als eigene Position aus (`src/lib/pricing/cart-totals.ts`, `src/components/checkout/parts.tsx`, `src/lib/checkout/post-order.ts`) und rechnet den Grundpreis ohne Pfand (`src/lib/pricing/base-price.ts`). Die Formulierung ist bewusst neutral ("fällt an", nicht "zusätzlich"), weil die Darstellung des Packpreises "inkl. Pfand" noch offen ist (Frage I1, auch H1 und H11). Wie Kunden die Dosen zurückgeben und das Pfand erstattet bekommen, steht noch nicht im Text (Frage I2).

- [ ] freigegeben

### Redaktionell (AGB)

1. "Verkauf von Waren ." und "Vertragssprache ist deutsch ." ohne Leerzeichen vor dem Punkt.
2. "Online - Warenkorbsystem" zu "Online-Warenkorbsystem".
3. Gliederung: Teile I und II und die Paragraphen als H2, die Nummern der Kundeninformationen als H3 (so zeigt die Seite sie heute schon an); die vier Einzellisten in § 5 Abs. 4 lit. c als eine Liste.
4. Anschrift in Kundeninformation 1 mit Zeilenumbrüchen in einem Absatz statt sechs Absätzen.

**Bewusst unverändert:** § 3 (Abonnement) bleibt wortgleich, weil es zum Go-live kein Abo gibt; die Präzisierung steht in Abschnitt 6. Ebenso unverändert, aber zur Prüfung markiert: der Händlerbund-Hinweis am Ende ("garantiert für die Rechtssicherheit der Texte"). Nach unseren Änderungen ist der Text nicht mehr der vom Händlerbund geprüfte Stand (Frage I4).

---

## 3. Widerrufsbelehrung

Pfad `/pages/ruckgabe-und-wiederrufsbelehrung`. Muster nach Anlage 1 zu Art. 246a EGBGB. Keine Shopify-Nennung im Text; die Shopify-App "EU Widerrufsbutton" ist durch das eigene Formular `/pages/widerruf-formular` ersetzt.

### WI-1. Hinweis auf die elektronische Widerrufsfunktion

**Alt:** fehlt (die Shopify-App stand nur auf einer eigenen Seite).

**Neu** (nach dem Absatz "Um Ihr Widerrufsrecht auszuüben ..."):

> Sie können das Muster-Widerrufsformular oder eine andere eindeutige Erklärung auch auf unserer Webseite https://www.provibe-drinks.de/pages/widerruf-formular ("Vertrag widerrufen") elektronisch ausfüllen und übermitteln. Machen Sie von dieser Möglichkeit Gebrauch, so werden wir Ihnen unverzüglich (z. B. per E-Mail) eine Bestätigung über den Eingang eines solchen Widerrufs übermitteln.

**Begründung:** Das ist der optionale Baustein, den die Muster-Widerrufsbelehrung für Online-Widerrufsformulare vorsieht, mit unserer Adresse eingesetzt. Er passt zur gebauten Funktion: Formular ohne Login, Bestellsuche optional, Eintrag in `withdrawal_requests`, sofortige Eingangsbestätigung per E-Mail (`src/lib/forms/withdrawal.ts`). Die Adresse ist absolut, weil die Belehrung auch in der Bestellmail steht. **Unsicherheit:** Seit 19.06.2026 gilt die Pflicht zur elektronischen Widerrufsfunktion. Ob der Gesetzgeber dabei auch das Muster selbst geändert hat und ob dieser Baustein genügt, kann ich nicht verlässlich sagen (Frage I5).

- [ ] freigegeben

### WI-2. Rücksendeadresse

**Alt:**

> Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen 14 Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns oder an Bei St Ursula 16a, 86150 Augsburg zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von 14 Tagen absenden.

**Neu:**

> Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen 14 Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von 14 Tagen absenden.

**Begründung:** Laut Annahme H5 gilt die Anschrift aus dem Impressum (Kurt-Viermetz-Straße 1a), die schon oben in der Belehrung steht ("uns"). Die zweite Adresse entfällt dann nach Muster. Das Widerrufsformular zeigt dieselbe Adresse (`returnAddress()` in `src/lib/content/settings.ts`). **Als offene Frage markiert (I6):** Falls Bei St Ursula 16a ein Lager oder eine Annahmestelle ist, die weiter gilt, bleibt der alte Satz stehen.

- [ ] freigegeben

### Redaktionell (Widerruf)

1. Die Einzellisten sind zu je einer Liste zusammengeführt.
2. Im Muster-Widerrufsformular steht "die Erbringung der folgenden Dienstleistung (*)" wieder in derselben Zeile wie "Hiermit widerrufe(n) ich/ wir ..."; im Shopify-Import war die Zeile abgerissen. Leerzeichen vor dem Doppelpunkt nach der E-Mail-Adresse entfernt.

**Bewusst unverändert:** Frist, Folgen, Kostentragung, Wertersatz, alle Ausschluss- und Erlöschensgründe (B11, Frage I7), E-Mail-Adresse support@ (H6, Frage I8), dritter Spiegelstrich zur regelmäßigen Lieferung (passt später auch für das Abo).

---

## 4. Versand (Zahlung und Versand)

Pfad `/pages/versand`. Ziel des Hinweises "zzgl. Versandkosten" auf Produktseiten und Karten.

### VS-1. Grundlage der Versandkostenfreiheit

**Alt:**

> Ab einem Bestellwert von 50,00 € liefern wir versandkostenfrei.

**Neu:**

> Ab einem Warenwert von 50,00 € liefern wir versandkostenfrei. Maßgeblich ist der Warenwert nach Abzug eines Rabatts und ohne Pfand.

**Begründung:** So rechnet der Shop (`selectShippingRate` in `src/lib/pricing/shipping.ts`, aufgerufen mit dem rabattierten Warenwert ohne Pfand in `src/lib/pricing/cart-totals.ts`). Ohne den Zusatz würden Kunden "Bestellwert" als Gesamtbetrag mit Pfand verstehen. Beispiel: zwei 9er-Packs kosten zusammen 52,20 € inklusive 4,50 € Pfand, der Warenwert liegt bei 47,70 €, also fallen 4,90 € Versand an.

- [ ] freigegeben

### VS-2. Pre-Sale-Lieferzeit entfällt

**Alt** (Ende des ersten Absatzes unter "Lieferfristen"):

> Im Pre-Sale ist mit einer lieferzeit von 6-8 Wochen zu rechnen.

**Neu:** entfällt.

**Begründung:** Laut Annahme H7 ist der Pre-Sale vorbei; Produktseiten, Warenkorb, Checkout und Bestellmail nennen "3 bis 5 Werktage" (`src/lib/checkout/delivery.ts`). Bitte bestätigen (B5, H7). Gibt es zum Go-live doch Vorbestellware, gehört die abweichende Lieferzeit an das jeweilige Angebot (das deckt der erste Satz "Soweit im jeweiligen Angebot keine andere Frist angegeben ist" ab).

- [ ] freigegeben

### VS-3. Versanddienstleister

**Alt:** fehlt.

**Neu** (letzter Absatz unter "Lieferfristen"):

> Der Versand erfolgt mit DHL.

**Begründung:** DHL ist gesetzt (Briefing 13). Die Angabe ist für Kunden nützlich und passt zur Datenschutzerklärung (DS-11). Rein informativ, keine neue Pflicht.

- [ ] freigegeben

### VS-4. Akzeptierte Zahlungsmöglichkeiten

**Alt:**

> - Zahlung per Kreditkarte
> - Zahlung per PayPal
> - Zahlung per Banküberweisung

**Neu:**

> - Zahlung per Karte (Visa, Mastercard, Maestro, American Express)
> - Zahlung per Apple Pay
> - Zahlung per Google Pay
> - Zahlung per PayPal
> - Zahlung per Klarna

**Begründung:** Entspricht den Zahlarten im Checkout (`PAYMENT_METHODS` in `src/lib/checkout/types.ts`) und im Footer (`src/components/layout/social.ts`). Banküberweisung bietet der neue Shop nicht an (Gap-Liste in `docs/analyse.md`, Abschnitt 7). Shop Pay und UnionPay entfallen mit Shopify. Voraussetzung: PayPal und Klarna sind im Stripe-Konto freigeschaltet (`docs/golive.md`); sonst streichen wir die Zeile vor der Freigabe.

- [ ] freigegeben

### VS-5. Weitere Einzelheiten zur Zahlung

**Alt:**

> Bei Zahlung per Kreditkarte erfolgt die Belastung Ihres Kreditkartenkontos mit Vertragsschluss.

**Neu:**

> Die Zahlungen werden über den Zahlungsdienstleister Stripe abgewickelt.
>
> Bei Zahlung per Karte, Apple Pay oder Google Pay erfolgt die Belastung Ihres Kartenkontos mit Vertragsschluss.
>
> Bei Zahlung per PayPal werden Sie nach dem Absenden der Bestellung zu PayPal weitergeleitet und bestätigen dort die Zahlungsanweisung an uns. Weitere Hinweise erhalten Sie im Bestellvorgang.
>
> Bei Zahlung per Klarna werden Sie nach dem Absenden der Bestellung zu Klarna weitergeleitet und wählen dort unter den Ihnen angebotenen Klarna-Zahlungsoptionen. Es gelten ergänzend die Bedingungen von Klarna, die Ihnen dort angezeigt werden.

**Begründung:** Shopify Payments ist durch Stripe ersetzt. Der Satz zur Kartenbelastung bleibt inhaltlich gleich und gilt jetzt auch für Debitkarten und Wallets (Stripe bucht beim Bestätigen sofort ab). PayPal und Klarna leiten nach dem Klick weiter (AGB-2). Welche Klarna-Optionen (sofort, Rechnung, Raten) ein Kunde sieht, entscheidet Klarna; deshalb nennt der Text keine einzelnen Optionen. Ob Klarna einen eigenen Pflichthinweis im Shop verlangt, prüfe ich, sobald das Stripe-Konto existiert (Frage I10).

- [ ] freigegeben

---

## 5. Datenschutzerklärung

Pfad `/policies/privacy-policy`. Der alte Text ist Shopifys Standard-Datenschutzerklärung (US-Stil, ohne Rechtsgrundlagen, ohne Dienstleisterliste, ohne Aufsichtsbehörde). Auftrag ist, Shopify durch die neuen Dienstleister zu ersetzen. Dabei kommen Pflichtangaben dazu, die der neue Betrieb auslöst (Rechtsgrundlagen, Speicherdauer, Cookies, Newsletter, Konto). Ich habe die übrigen Shopify-Formulierungen stehen lassen, auch wo sie generisch sind, damit der Eingriff überschaubar bleibt. Meine Empfehlung bleibt, den Text insgesamt durch eine DSGVO-Vorlage zu ersetzen (Frage I9).

### DS-1. Zeile "Letzte Fassung" entfällt

| Alt                            | Neu      |
| ------------------------------ | -------- |
| `Letzte Fassung: 2. Juli 2026` | entfällt |

**Begründung:** Die Seite zeigt "Stand" und "Version" automatisch aus `effective_from` (`src/components/content/LegalPage.tsx`). Ein fest im Text stehendes Datum würde veralten. Folgeänderung DS-21.

- [ ] freigegeben

### DS-2. Einleitung: Verantwortlicher statt Shopify

**Alt:**

> Provibe betreibt diesen Shop und diese Website, [...] (die „Services“). Provibe basiert auf Shopify, wodurch wir in der Lage sind, Ihnen die Services bereitzustellen. In dieser Datenschutzerklärung [...]

**Neu:**

> Die CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg („provibe“, „wir“) betreibt diesen Shop und diese Website, [...] (die „Services“). Für den Betrieb der Services setzen wir die im Abschnitt „Dienstleister und Empfänger“ genannten Dienstleister ein. In dieser Datenschutzerklärung [...] (Rest wortgleich)

**Begründung:** Shopify entfällt. Der Verantwortliche muss mit Namen und Anschrift genannt sein; "Provibe" ist nur die Marke, Vertragspartner und Verantwortliche ist laut Impressum die UG.

- [ ] freigegeben

### DS-3. Keine "Einwilligung durch Nutzung"

**Alt:**

> Lesen Sie sich diese Datenschutzerklärung bitte sorgfältig durch. Indem Sie einen der Services nutzen und darauf zugreifen, bestätigen Sie, dass Sie diese Datenschutzerklärung gelesen haben und mit der Erfassung, Verwendung und Weitergabe Ihrer Daten, wie in dieser Datenschutzerklärung beschrieben, einverstanden sind.

**Neu:**

> Lesen Sie sich diese Datenschutzerklärung bitte sorgfältig durch. Auf welcher Rechtsgrundlage wir Ihre Daten jeweils verarbeiten, erläutern wir in den einzelnen Abschnitten und im Abschnitt „Rechtsgrundlagen“. Soweit eine Verarbeitung auf Ihrer Einwilligung beruht, holen wir diese gesondert ein; die bloße Nutzung der Services gilt nicht als Einwilligung.

**Begründung:** Der neue Shop holt Einwilligungen ausdrücklich ein (Consent-Banner, Newsletter mit Double Opt-in). Eine Einwilligung durch bloße Nutzung widerspräche dem und ist nach DSGVO keine wirksame Einwilligung. Das geht über das reine Ersetzen von Shopify hinaus, deshalb einzeln zur Freigabe.

- [ ] freigegeben

### DS-4. Kategorie "Finanzdaten" wird "Zahlungsdaten"

**Alt:**

> Finanzdaten einschließlich Kredit-, Debitkarten- und Finanzkontonummern, Zahlungskarteninformationen, Finanzkontoinformationen, Transaktionsdetails, Zahlungsart, Zahlungsbestätigung und andere Zahlungsdetails.

**Neu:**

> Zahlungsdaten einschließlich Zahlungsart, Transaktionsdetails, Zahlungsbestätigung und andere Zahlungsdetails; bei Kartenzahlungen erhalten wir nur die Kartenmarke und die letzten vier Ziffern der Kartennummer. Vollständige Karten- und Kontodaten geben Sie direkt bei unserem Zahlungsdienstleister Stripe beziehungsweise bei PayPal oder Klarna ein; sie werden nicht auf unseren Systemen gespeichert.

**Begründung:** Kartendaten gehen über das Stripe Payment Element direkt an Stripe ("Zahlungsdaten gehen verschlüsselt direkt an Stripe, nicht an uns" in `PaymentForm.tsx`). Der Shop speichert nur Zahlart, Marke und letzte vier Ziffern (`PaymentDetails` in `src/lib/checkout/finalize.ts`).

- [ ] freigegeben

### DS-5. Kategorie "Kontoinformationen"

**Alt:** "Kontoinformationen darunter Benutzername, Passwort, Sicherheitsfragen, Konfigurationen und Einstellungen."

**Neu:** "Kontoinformationen darunter E-Mail-Adresse, Passwort (nur als verschlüsselter Hashwert gespeichert und nur, wenn Sie ein Passwort festlegen), Konfigurationen und Einstellungen."

**Begründung:** Supabase Auth kennt keinen Benutzernamen und keine Sicherheitsfragen; Login per Magic Link oder optionalem Passwort (`docs/konto-und-abo-plan.md`, Teil A).

- [ ] freigegeben

### DS-6. Kategorie "Transaktionsinformationen" ohne Wunschliste

**Alt:** "... die Sie sich ansehen, in den Warenkorb legen, auf die Wunschliste setzen oder kaufen, ..."

**Neu:** "... die Sie sich ansehen, in den Warenkorb legen oder kaufen, ..."

**Begründung:** Der Shop hat keine Wunschliste.

- [ ] freigegeben

### DS-7. Neue Kategorie "Einwilligungsdaten"

**Alt:** fehlt.

**Neu:**

> Einwilligungsdaten einschließlich Ihrer Auswahl im Cookie-Banner sowie, bei der Newsletter-Anmeldung, Zeitpunkt, IP-Adresse und Wortlaut Ihrer Einwilligung.

**Begründung:** Neu gespeichert in `consent_logs` und `newsletter_contacts` (`confirmed_at`, `confirm_ip`, `confirm_user_agent`, `consent_text`, `consent_version`).

- [ ] freigegeben

### DS-8. Zweck "Marketing und Werbung": Einwilligung als Voraussetzung

**Alt:** Absatz endet mit "... sowie anderen Aktivitäten in Bezug auf die Services."

**Neu:** angehängt:

> Werbe-E-Mails senden wir nur mit Ihrer Einwilligung (siehe Abschnitt „Newsletter“), Online-Werbung auf Grundlage Ihrer Aktivitäten nur nach Ihrer Einwilligung im Cookie-Banner (siehe Abschnitt „Cookies, Einwilligung und Tracking“).

**Begründung:** Stellt den neuen, einwilligungsbasierten Betrieb klar (Briefing 5 und 6). Der Rest des Absatzes bleibt wortgleich, auch "SMS oder Post", obwohl wir derzeit nur E-Mail nutzen.

- [ ] freigegeben

### DS-9. Weitergabe an Dienstleister

**Alt:**

> Bei Shopify sind dies Anbieter und andere Dritte, die in unserem Auftrag Services erbringen (z. B. IT-Management, Zahlungsabwicklung, Datenanalyse, Kundensupport, Cloud-Speicher, Fulfillment und Versand).

**Neu:**

> An Anbieter und andere Dritte, die in unserem Auftrag Services erbringen (z. B. Hosting, Datenbank, Zahlungsabwicklung, E-Mail-Versand, Rechnungsstellung, Versand). Diese Dienstleister sind im Abschnitt „Dienstleister und Empfänger“ einzeln aufgeführt.

**Begründung:** Shopify entfällt; die Beispiele entsprechen den tatsächlichen Diensten.

- [ ] freigegeben

### DS-10. Weitergabe an Marketingpartner

**Alt:**

> Wir geben personenbezogene Daten an Geschäfts- und Marketingpartner weiter, die für Sie Marketingservices erbringen und Ihnen Werbung anzeigen. Wir nutzen Shopify beispielsweise, um personalisierte Werbung mit Services von Drittanbietern zu unterstützen, die auf Ihren Online-Aktivitäten bei verschiedenen Händlern und Websites basieren. Unsere Geschäfts- und Marketingpartner [...]

**Neu:**

> Wir geben personenbezogene Daten an Geschäfts- und Marketingpartner (Meta, Google und TikTok) weiter, die für Sie Marketingservices erbringen und Ihnen Werbung anzeigen, jedoch nur, wenn Sie hierin über unser Cookie-Banner eingewilligt haben (siehe Abschnitt „Cookies, Einwilligung und Tracking“). Unsere Geschäfts- und Marketingpartner [...] (Rest wortgleich)

**Begründung:** Shopify-Satz entfällt; Tracking nur mit Einwilligung (Briefing 5 und 6).

- [ ] freigegeben

### DS-11. Abschnitt "Beziehung mit Shopify" wird "Dienstleister und Empfänger"

**Alt:** gesamter Abschnitt "Beziehung mit Shopify" (Shopify als Host und für "erweiterte Funktionen" eigenverantwortlich, Links auf die Shopify-Datenschutzrichtlinie und das Shopify-Datenschutzportal).

**Neu:** Abschnitt "Dienstleister und Empfänger" mit Einleitung (Verträge zur Auftragsverarbeitung, Verweis auf internationale Übertragungen) und je einem Unterabschnitt:

| Dienst                         | Anbieter laut Entwurf                                                                                                        | Zweck und Daten                                                                                                                                    | Rechtsgrundlage im Text       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Hosting, CDN, Serverfunktionen | Netlify, Inc. (USA)                                                                                                          | Auslieferung der Website, Server-Logfiles (IP, Zeit, Seite, Datenmenge, Browser), Bestellannahme und Formulare; Hinweis: Schriften selbst gehostet | lit. f, bei Bestellung lit. b |
| Datenbank, Konto, Dateien      | Supabase Inc. (USA), Rechenzentrum Frankfurt am Main                                                                         | Bestell-, Kunden-, Kontodaten, Rechnungs-PDFs, Login per Magic Link oder Passwort                                                                  | lit. b und c                  |
| Zahlung                        | Stripe Payments Europe, Ltd. (Irland); PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg); Klarna Bank AB (publ) (Schweden) | Payment Element, Betrugsprävention; PayPal und Klarna in eigener Verantwortung nach Weiterleitung; Hinweis auf Apple und Google bei Wallets        | lit. b, Betrug lit. f         |
| E-Mail                         | Resend, Sitz USA                                                                                                             | Bestell-, Rechnungs-, Konto-, Widerrufsmails und Newsletter                                                                                        | lit. b, Newsletter lit. a     |
| Rechnungen                     | Haufe-Lexware GmbH &amp; Co. KG (Freiburg)                                                                                   | Name, Rechnungsanschrift, E-Mail, Positionen                                                                                                       | lit. b und c                  |
| Versand                        | DHL Paket GmbH (Bonn)                                                                                                        | Name und Lieferanschrift; **keine** E-Mail und Telefonnummer                                                                                       | lit. b                        |

Den genauen Wortlaut findest du in der Migration (Abschnitt 5, ab "Dienstleister und Empfänger").

**Begründung:** Kernauftrag aus Briefing 5. Bewusst ohne Straßenanschriften der Anbieter, weil ich die Vertragspartner nicht aus den Verträgen kenne, sondern nur aus allgemeiner Kenntnis; Name und Sitzland reichen für die Information über Empfänger. **Vor der Freigabe zu prüfen (Frage I10):** Vertragspartner je Anbieter laut Vertrag, abgeschlossene Auftragsverarbeitungsverträge (der Text behauptet, dass sie bestehen), Rolle von Stripe, PayPal und Klarna (Auftragsverarbeiter oder eigene Verantwortung), Netlify-Region der Serverfunktionen. DHL: Der Text sagt, dass wir E-Mail und Telefon **nicht** weitergeben; die DHL-Schnittstelle (`src/lib/integrations/shipping/types.ts`) hat dafür optionale Felder, die beim Anbinden leer bleiben müssen (Frage I11).

- [ ] freigegeben

### DS-12. Neuer Abschnitt "Kundenkonto" mit Löschung

**Alt:** fehlt (Shopify-Konto lief über shopify.com).

**Neu:** zwei Absätze: freiwilliges Konto, gespeicherte Daten, Zuordnung früherer Gastbestellungen mit derselben E-Mail, Login per Anmeldelink oder Passwort (lit. b); Selbstlöschung unter "Deine Daten" mit Löschung von Zugang und Adressen, Entfernen von Name, Telefon und E-Mail aus dem Profil, Newsletter-Abmeldung; Bestellungen und Rechnungen bleiben wegen § 147 AO und § 257 HGB bis Fristablauf und werden nur noch dafür genutzt (lit. c).

**Begründung:** Entspricht dem gebauten Ablauf: `deleteAccount` in `src/lib/auth/account-actions.ts` und `anonymize_customer()` in `supabase/migrations/20261017103000_konto_auth.sql` (löscht `customer_addresses`, pseudonymisiert `customers`, setzt Newsletter auf abgemeldet, Bestellungen bleiben). Die Zuordnung von Gastbestellungen macht `claim_guest_orders_for()`. Der Satz "nur noch zu diesem Zweck" ist eine Zusage, die das Backoffice einhalten muss (Checkliste, Kontolöschung).

- [ ] freigegeben

### DS-13. Neuer Abschnitt "Newsletter" (Double Opt-in)

**Alt:** fehlt.

**Neu:** Anmeldung im Footer oder bei der Bestellung, Bestätigungslink, Aufnahme erst nach Klick, Nachweis (Zeitpunkte, IP und Browser bei Bestätigung, Wortlaut), Übernahme des Status aus dem früheren Shop, Rechtsgrundlagen (lit. a, Nachweis lit. f mit Art. 7 Abs. 1), Abmeldung über Link in jeder Mail oder im Konto, Vermerk als abgemeldet.

**Begründung:** Entspricht `src/lib/newsletter/actions.ts`, `src/lib/newsletter/consent.ts`, `src/app/newsletter/bestaetigen/page.tsx` und dem Checkout-Häkchen (`subscribeNewsletterFromCheckout`). Der Satz zum früheren Shop beschreibt den Import nach D3 ehrlich; ob der Shopify-Status als Nachweis reicht, ist Frage I13. **Nicht im Text:** Öffnungs- und Klickmessung im Newsletter. Briefing 8 sieht Kennzahlen vor; das braucht nach meiner Einschätzung einen Hinweis und eventuell eine Erweiterung des Einwilligungstexts (Frage I12). Bis dahin Messung aus. **Voraussetzung:** Abmeldelink in jeder Newsletter-Mail und Seite `/newsletter/abmelden` (laut `docs/seitenplan.md` noch offen).

- [ ] freigegeben

### DS-14. Neuer Abschnitt "Kontaktformulare und Widerruf"

**Alt:** fehlt (nur allgemein "Kommunikation mit uns").

**Neu:** Kontakt-, Partner- und Widerrufsformular oder E-Mail, verarbeitete Angaben, kurzzeitig gespeicherter Hash der IP-Adresse gegen Missbrauch, Rechtsgrundlagen lit. b, beim Widerruf zusätzlich lit. c, sonst lit. f.

**Begründung:** Eigene Formulare ersetzen Shopify Contact und die Widerrufs-App (`src/lib/forms/*`, Rate Limit mit `ipHash` in `src/lib/security/rate-limit.ts`).

- [ ] freigegeben

### DS-15. Neuer Abschnitt "Cookies, Einwilligung und Tracking"

**Alt:** nur der Halbsatz "über die Verwendung von Cookies und ähnlichen Technologien" bei den Quellen; Shopify-Cookies wurden nicht erklärt.

**Neu:**

1. Technisch notwendige Cookies ohne Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG) mit Liste: `pv_cart` (90 Tage), `sb-…` (Anmeldung), `pv_contact_sent`, `pv_partner_sent`, `pv_withdrawal_sent` (10 Minuten), Consent-Cookie **[OFFEN: Name und Speicherdauer]**.
2. Alle anderen Dienste erst nach Einwilligung (§ 25 Abs. 1 TDDDG, lit. a), gleichwertiges Annehmen und Ablehnen, Kategorien, Widerruf über "Cookie-Einstellungen" im Footer, Nachweis im Consent-Log (Kennung, Banner-Version, IP-Hash, Browser).
3. Unterabschnitte Meta-Pixel und Conversions API (Meta Platforms Ireland Ltd., gemeinsame Verantwortung nach Art. 26 DSGVO für Erhebung und Übermittlung, gehashte E-Mail und Telefon), Google Analytics 4 und Google Ads mit erweiterten Conversions (Google Ireland Limited, ohne Einwilligung kein Laden der Google-Dienste), TikTok-Pixel und Events API (TikTok Technology Limited), Kampagnenparameter (utm, gclid, fbclid, ttclid) nur mit Einwilligung.

**Begründung:** Briefing 5 (Consent nach TDDDG, kein Tracking vor Einwilligung, Consent-Log) und 6 (Meta, Google, TikTok jeweils Browser und Server, UTM und Klick-IDs mit Consent). Cookie-Namen und Laufzeiten stammen aus dem Code (`src/lib/cart/actions.ts`, `src/lib/forms/common.ts`, `@supabase/ssr`). "Ohne Einwilligung laden wir die Google-Dienste nicht" entspricht der Briefing-Vorgabe; der "erweiterte" Consent Mode mit cookielosen Pings vor der Einwilligung wäre damit ausgeschlossen. **Voraussetzungen:** Das Banner ist noch nicht gebaut (`docs/golive.md`, Lückenanalyse Punkt 3); die Kategorien müssen "Statistik" und "Marketing" heißen, der Footer-Link "Cookie-Einstellungen". Jeder Tracking-Absatz bleibt nur stehen, wenn der Dienst beim Go-live wirklich aktiv ist.

- [ ] freigegeben

### DS-16. Neuer Abschnitt "Rechtsgrundlagen"

**Alt:** fehlt.

**Neu:** Liste lit. b, c, f, a mit Beispielen; Hinweis auf Pflichtfelder bei der Bestellung; Hinweis auf das Widerspruchsrecht nach Art. 21 DSGVO bei berechtigten Interessen.

**Begründung:** Ohne Angabe der Rechtsgrundlagen fehlt eine Pflichtinformation nach Art. 13 DSGVO; der Shopify-Text hatte keine. Der Widerspruchshinweis gehört dazu, sobald wir uns auf berechtigte Interessen stützen. Neuer Text über das reine Ersetzen hinaus, deshalb einzeln zur Freigabe.

- [ ] freigegeben

### DS-17. Aufbewahrung konkretisiert

**Alt:** zwei Absätze (keine perfekte Sicherheit; Dauer "hängt von verschiedenen Faktoren ab").

**Neu:** beide Absätze wortgleich, dazu ein dritter:

> Insbesondere gilt: Bestell- und Rechnungsdaten bewahren wir für die Dauer der gesetzlichen Aufbewahrungsfristen auf (insbesondere § 147 AO und § 257 HGB, derzeit bis zu zehn Jahre). Daten Ihres Kundenkontos speichern wir, bis Sie das Konto löschen. Newsletter-Daten speichern wir bis zu Ihrer Abmeldung, den Nachweis Ihrer Einwilligung darüber hinaus, solange Ansprüche im Zusammenhang mit der Einwilligung geltend gemacht werden können.

**Begründung:** Speicherdauer oder Kriterien sind Pflichtangabe. "Bis zu zehn Jahre" ist bewusst als Obergrenze formuliert: Seit 2025 gelten für Buchungsbelege nach meinem Kenntnisstand acht statt zehn Jahre, für Bücher und Abschlüsse weiter zehn. Die genauen Fristen soll die Steuerberatung bestätigen (Frage I9).

- [ ] freigegeben

### DS-18. Rechte: Shopify-Verweis entfällt

**Alt:**

> Sie können diese Rechte ausüben, wenn dies in den Services entsprechend angegeben ist, oder indem Sie sich über die unten angegebenen Kontaktdaten mit uns in Verbindung setzen. Mehr Informationen darüber, wie Shopify Ihre personenbezogenen Daten verwendet und welche Rechte Sie haben, einschließlich der Rechte in Bezug auf die von Shopify verarbeiteten Daten, finden Sie unter https://privacy.shopify.com/en.

**Neu:** nur der erste Satz bleibt.

**Begründung:** Shopify verarbeitet nach der Umstellung keine Daten mehr für uns. Hinweis: Eine Selbstbedienung für Auskunft und Export gibt es im Konto noch nicht (Checkliste); bis dahin laufen Anfragen über die Kontaktdaten.

- [ ] freigegeben

### DS-19. Beschwerden: zuständige Aufsichtsbehörde

**Alt:** Absatz endet mit dem Link auf die EDPB-Liste.

**Neu:** angehängt:

> Für uns zuständig ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), www.lda.bayern.de.

**Begründung:** Für nicht öffentliche Stellen mit Sitz in Bayern ist das BayLDA zuständig. Bewusst ohne Postanschrift, damit keine veraltete Adresse im Text steht.

- [ ] freigegeben

### DS-20. Internationale Übertragungen: Bezug auf die Dienstleister

**Alt:** zwei Absätze (Übertragung möglich; Standardvertragsklauseln oder Angemessenheit).

**Neu:** ersten Absatz ergänzt um "Das betrifft insbesondere die im Abschnitt „Dienstleister und Empfänger“ und im Abschnitt „Cookies, Einwilligung und Tracking“ genannten Anbieter mit Sitz oder Konzernverbindungen außerhalb des Europäischen Wirtschaftsraums."; zweiten Absatz ergänzt um "Für Übermittlungen in die USA an Unternehmen, die nach dem EU-US Data Privacy Framework zertifiziert sind, besteht ein solcher Angemessenheitsbeschluss der Europäischen Kommission."

**Begründung:** Netlify, Supabase, Resend sind US-Unternehmen, Meta und Google übermitteln in die USA, TikTok auch in weitere Drittländer. Welcher Anbieter zertifiziert ist und wo Standardvertragsklauseln gelten, behauptet der Text bewusst nicht einzeln (Frage I10).

- [ ] freigegeben

### DS-21. Änderungen: Bezug auf den Stand statt "Letzte Fassung"

**Alt:** "... passen das Datum der „Letzten Fassung“ entsprechend an ..."

**Neu:** "... passen den angegebenen Stand entsprechend an ..."

**Begründung:** Folgeänderung zu DS-1.

- [ ] freigegeben

### DS-22. Kontakt: Verantwortlicher mit Firmennamen

**Alt:** "... per Post an Provibe, Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland an uns. Im Sinne der geltenden Datenschutzgesetze sind wir der Datenverantwortliche für Ihre personenbezogenen Daten."

**Neu:** "... per Post an CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland an uns. Im Sinne der geltenden Datenschutzgesetze sind wir der Verantwortliche für Ihre personenbezogenen Daten."

**Begründung:** Wie DS-2; "Verantwortlicher" ist der Begriff der DSGVO.

- [ ] freigegeben

### Redaktionell (Datenschutz)

1. Überschrift "Wie verwenden wir Ihre personenbezogene Daten?" zu "personenbezogenen"; ebenso "in Bezug auf Ihre personenbezogenen Daten" und "fehlerhafter personenbezogener Daten".
2. "Wenn Sie sich Ihr Wohnsitz im Vereinigten Königreich ..." zu "Wenn sich Ihr Wohnsitz ...".
3. "Wenn Sie sich abrufen möchten" zu "Wenn Sie sie abrufen möchten".
4. Die fett gesetzten Stichworte (zum Beispiel "Direkt von Ihnen.", "Recht auf Löschung.") wieder als Hervorhebung mit Punkt; beim Shopify-Import waren sie mit dem folgenden Satz verschmolzen. Die H1 im Text entfällt (die Seite hat ihre eigene), alle Aufzählungen sind echte Listen.

**Bewusst unverändert:** Formulierungen ohne Shopify-Bezug, auch wo sie generisch sind (Empfehlungen, Bewertungen, Affiliates und Unternehmensgruppe, Daten von Kindern, Links zu Drittanbietern). Kein Datenschutzbeauftragter genannt, weil keiner benannt ist (Frage I9).

---

## 6. Abo-Bedingungen und Kündigungsbutton (§ 312k BGB)

> **Erst mit Abo-Start aktiv. Nicht Teil von Version 2.** Diese Bausteine werden als Version 3 von AGB, Datenschutzerklärung und gegebenenfalls Widerrufsbelehrung eingespielt, sobald das Abo nach `docs/konto-und-abo-plan.md` (Teil B) verkauft wird. Bis dahin bleibt § 3 der AGB wortgleich (er gilt nur "bei Abonnement-Verträgen" und ist ohne Abo-Angebot gegenstandslos).

### ABO-1. AGB § 3 Abs. 1, Laufzeit und Kündigungsfrist

**Alt (und Version 2):**

> (1) Der zwischen Ihnen und uns geschlossene Abonnement-Vertrag hat eine unbestimmte Laufzeit. Der Vertrag kann von beiden Parteien mit einer Frist von einem Monat zum Monatsende (soweit im jeweiligen Angebot nichts anderes geregelt ist) gekündigt werden.

**Vorschlag für Version 3, zwei Varianten:**

- **Variante A (empfohlen, kein Eingriff):** Text bleibt. Das Abo-Angebot im Checkout regelt abweichend "jederzeit kündbar zum nächsten Liefertermin"; der Händlerbund-Text lässt das ausdrücklich zu ("soweit im jeweiligen Angebot nichts anderes geregelt ist").
- **Variante B (präziser):** "(1) Der zwischen Ihnen und uns geschlossene Abonnement-Vertrag hat eine unbestimmte Laufzeit. Sie erhalten die gewählten Waren im gewählten Lieferintervall. Sie können den Vertrag jederzeit mit Wirkung zum nächsten Liefertermin kündigen, sofern die Kündigung vor der Abbuchung für diese Lieferung bei uns eingeht; andernfalls wirkt sie zum darauffolgenden Liefertermin. Wir können den Vertrag mit einer Frist von einem Monat zum Monatsende kündigen."

**Begründung:** Der Plan sieht "kündigen mit einem Klick, jederzeit zum nächsten Liefertermin" vor. Variante B formuliert Fristen neu; das ist eine eigene Klausel und braucht die Entscheidung des Anwalts (Frage I17).

- [ ] Variante A
- [ ] Variante B
- [ ] anders

### ABO-2. AGB § 3 Abs. 3, Kündigungsbutton

**Alt (und Version 2):** "(3) Jede Kündigung muss entweder in Textform (z.B. E-Mail) oder über die auf unserer Internetpräsenz eingebundene Kündigungsschaltfläche (“Verträge hier kündigen” oder ähnliche Bezeichnung) erklärt und übermittelt werden."

**Vorschlag für Version 3:** Text bleibt wortgleich. Er passt, wenn die Umsetzung so aussieht: dauerhaft sichtbarer Link "Verträge hier kündigen" (Footer, ohne Login erreichbar) auf `/abo-kuendigen`, dort Angaben zur Identifikation (Name, E-Mail, optional Abo- oder Bestellnummer, Kündigungsart und Zeitpunkt), Bestätigungsbutton "jetzt kündigen", danach Bestätigungsseite zum Speichern und sofortige Eingangsbestätigung per E-Mail mit Datum und Uhrzeit der Kündigung.

**Achtung, Abweichung vom Plan:** `docs/konto-und-abo-plan.md` sieht auf `/abo-kuendigen` "E-Mail und Bestätigungslink" vor. Wenn die Kündigung erst mit dem Klick auf einen Link in einer E-Mail wirksam wird, ist das eine zusätzliche Hürde, die § 312k BGB nach meinem Verständnis nicht zulässt. Empfehlung: Die Kündigung wird mit "jetzt kündigen" abgegeben, die E-Mail ist nur die Bestätigung. Bitte vom Anwalt bestätigen lassen (Frage I17).

- [ ] freigegeben

### ABO-3. Kundeninformationen 8

**Alt (und Version 2):** Verweis auf § 3 und "im jeweiligen Angebot".

**Vorschlag für Version 3:** unverändert.

- [ ] freigegeben

### ABO-4. Widerrufsbelehrung

**Vorschlag für Version 3:** keine Änderung nötig. Der dritte Spiegelstrich ("erste Ware ... zur regelmäßigen Lieferung über einen festgelegten Zeitraum") deckt die Fristberechnung bei Abos ab. Zu prüfen: ob das Abo (unbestimmte Laufzeit statt "festgelegter Zeitraum") darunter fällt (Frage I17).

- [ ] freigegeben

### ABO-5. Datenschutzerklärung, neuer Absatz unter "Zahlungsabwicklung"

**Vorschlag für Version 3:**

> Wenn Sie ein Abo abschließen, speichert Stripe Ihr Zahlungsmittel für künftige Lieferungen; wir erhalten nur eine Referenz darauf sowie Kartenmarke und letzte vier Ziffern. Die Abbuchung für jede Lieferung erfolgt zum jeweiligen Liefertermin ohne erneute Bestätigung durch Sie, es sei denn, Ihre Bank verlangt eine Bestätigung. Einige Tage vor jeder Abbuchung erhalten Sie eine Erinnerung per E-Mail. Rechtsgrundlage ist die Erfüllung des Abo-Vertrags (Art. 6 Abs. 1 lit. b DSGVO).

**Begründung:** Plan Teil B (SetupIntent mit `off_session`, Erinnerungsmail drei Tage vorher). Wird erst mit dem Abo eingespielt.

- [ ] freigegeben

### Weitere Abo-Punkte ohne Textvorschlag

- **Pflichtangaben vor dem Button im Abo-Checkout:** Intervall, Preis je Lieferung inklusive Pfand und Versand, Grundpreis, Rabatt, Laufzeit "unbestimmt", Kündigung "jederzeit zum nächsten Liefertermin", Button weiter "Zahlungspflichtig bestellen" (Checkliste).
- **Preisanpassung bei laufenden Abos:** Der Plan sieht Ankündigung vier Wochen vorher vor. Eine Preisanpassungsklausel in AGB ist rechtlich heikel; ohne Klausel bleibt nur Kündigung und neues Angebot. Keine eigene Formulierung von mir (Frage I17).

---

## 7. Prüfpunkte ohne Textänderung

Diese Themen aus dem Auftrag ändern keinen der fünf Texte, gehören aber zur Freigabe:

- **Grundpreis:** keine Klausel nötig, es ist eine Anzeigepflicht. Der Hinweis "Grundpreis ohne Pfand" steht in AGB-5. Umsetzung siehe `docs/legal-checklist.md`.
- **Pfand-Darstellung "inkl. Pfand" im Packpreis:** betrifft Anzeige, nicht Text (Frage I1).
- **Streichpreise (H17):** Bundles zeigen "Einzeln: X €" als Summe der aktuellen Einzelpreise (`compare_at_kind = components_sum`), Packgrößen keinen Streichpreis, "former_price" bleibt ausgeschaltet. Eine Erläuterung im Rechtstext ist nicht üblich und nicht vorgesehen (Frage I16).
- **Rabattcodes:** Rabatt wirkt nur auf den Warenwert, nie auf Pfand und Versand (`src/lib/pricing/cart-totals.ts`). Ob die Werbung mit "10 % mit Code PRESALE10" eine Preisermäßigung mit 30-Tage-Angabe auslöst, ist Frage I15.
- **Bewertungen:** Die Datenschutzerklärung erwähnt die Möglichkeit, Bewertungen abzugeben (wortgleich aus Shopify). Ein eigener Absatz zur Bewertungsanfrage per E-Mail kommt erst, wenn H20 entschieden ist.

## 8. Ablauf bis zur Veröffentlichung

1. Du und dein Anwalt hakt die Kästchen ab oder schreibt Änderungen dazu. Ich übertrage Änderungen in die Entwürfe (solange `status = 'draft'`, sind sie änderbar).
2. Offene Marker auflösen: Consent-Cookie (DS-15), LUCID in `shop_settings` (IM-2), Rücksendeadresse (WI-2), Pre-Sale (VS-2), aktive Zahlarten (VS-4), aktive Tracking-Dienste (DS-15).
3. Veröffentlichen je Text: `status = 'published'`, `effective_from` auf den Go-live-Zeitpunkt, `published_at` und `published_by` setzen (Anleitung im Kopf der Migration). Ab dann ist die Version unveränderlich (Trigger `legal_versions_immutable` aus `20261017204200_crm_content_legal.sql`); Korrekturen werden Version 3.
4. Die Storefront zeigt automatisch die höchste veröffentlichte Version mit erreichtem `effective_from` (`src/lib/content/legal.ts`), neue Bestellungen speichern deren IDs in `orders.legal_versions`, die Bestellmail enthält AGB und Widerruf in dieser Fassung. Seiten-Cache: Revalidierung nach dem Veröffentlichen auslösen.
5. Nicht remote anwenden, bevor du freigibst. Die Migration ist lokal geprüft (`bash scripts/db/local-pg.sh migrate`, zweiter Lauf ohne Wirkung, anon sieht keine Entwürfe).

## 9. Offene Rechtsfragen

Ausführlich mit Empfehlung in `docs/fragen.md`, Abschnitt I. Kurzfassung:

1. **I1. Pfand im Packpreis.** Produktseite, Bundle-Karten und Bestellzeilen zeigen "26,10 € inkl. 2,25 € Pfand". Die PAngV verlangt nach meinem Verständnis, das Pfand neben dem Preis anzugeben, ohne einen Gesamtbetrag zu bilden. Empfehlung: Preise ohne Pfand anzeigen ("23,85 € zzgl. 2,25 € Pfand"), Summe mit Pfand nur im Gesamtbetrag der Bestellung; vom Anwalt bestätigen lassen.
2. **I2. Rückgabe der Pfanddosen.** Welche Rücknahmepflicht hat ein Online-Händler nach dem Verpackungsgesetz, und was sagen wir Kunden dazu? Empfehlung: Anwalt oder DPG-Systemberatung fragen, dann einen Satz in Kundeninformation 5.5 ergänzen.
3. **I3. Vertragsschluss bei gescheiterter Zahlung.** Vertrag entsteht laut AGB mit dem Klick, der Shop legt die Bestellung aber erst nach erfolgreicher Zahlung an. Empfehlung: Anwalt entscheidet, ob § 2 Abs. 3 einen Satz dazu braucht; bis dahin Händlerbund-Logik.
4. **I4. Händlerbund-Hinweis.** Nach unseren Änderungen ist der Text nicht mehr der geprüfte Stand. Empfehlung: Mitgliedschaft prüfen und den Text im Händlerbund-Portal für "eigener Shop mit Stripe" neu erzeugen und mit diesem Entwurf abgleichen; ohne Mitgliedschaft den Hinweis streichen.
5. **I5. Muster-Widerrufsbelehrung seit Juni 2026.** Reicht der optionale Baustein (WI-1), oder ist das Muster geändert? Empfehlung: aktuelle Fassung vom Anwalt oder Händlerbund einsetzen lassen.
6. **I6. Rücksendeadresse.** Kurt-Viermetz-Straße 1a (Annahme H5) oder weiter zusätzlich Bei St Ursula 16a? Empfehlung: nur Kurt-Viermetz-Straße 1a.
7. **I7. Widerrufsausnahmen für Lebensmittel.** Unverändert übernommen (B11). Empfehlung: Anwalt entscheidet, ob einzelne Ausschlüsse für Eistee in Dosen überhaupt greifen; nichts selbst ergänzen.
8. **I8. Postfach in der Widerrufsbelehrung.** support@ bleibt (H6). Empfehlung: nur, wenn das Postfach sicher abgerufen wird; sonst hello@.
9. **I9. Datenschutzerklärung als Ganzes.** Shopify-Vorlage mit Ergänzungen statt DSGVO-Vorlage; dazu Datenschutzbeauftragter (nach meiner Einschätzung nicht nötig) und genaue Aufbewahrungsfristen. Empfehlung: Text mittelfristig durch eine geprüfte Vorlage ersetzen, Fristen mit der Steuerberatung klären.
10. **I10. Dienstleister-Verträge.** Vertragspartner, AVVs, Rolle von Stripe, PayPal, Klarna, Drittlandgrundlage je Anbieter, Netlify-Region der Serverfunktionen, Klarna-Hinweispflichten. Empfehlung: vor der Veröffentlichung abschließen und Text angleichen.
11. **I11. DHL-Paketankündigung.** E-Mail oder Telefon an DHL nur mit Einwilligung? Empfehlung: zum Start nicht übermitteln (so steht es im Text), später optionales Häkchen.
12. **I12. Newsletter-Öffnungs- und Klickmessung.** Empfehlung: aus, bis Einwilligungstext und Datenschutzerklärung das abdecken.
13. **I13. Importierte Newsletter-Kontakte (D3).** Reicht der Shopify-Status ohne Double-Opt-in-Nachweis? Empfehlung: Anwalt; im Zweifel einmalige Re-Permission vor dem ersten Versand.
14. **I14. Bewertungsanfrage (H20).** Bleibt aus, bis entschieden; erst dann Absatz in der Datenschutzerklärung.
15. **I15. Rabattcodes und Preisermäßigung.** Löst die Werbung mit "10 % mit Code" die 30-Tage-Angabe aus? Empfehlung: Anwalt; bis dahin keine Streichpreise zu Code-Aktionen.
16. **I16. Bundle-Vergleichspreis "Einzeln: X €" (H17).** Zulässig als Vergleich mit eigenen aktuellen Einzelpreisen? Empfehlung: bestätigen lassen.
17. **I17. Abo.** Kündigung ohne Bestätigungslink (ABO-2), Variante A oder B (ABO-1), Dauerlieferung ohne festen Zeitraum in der Widerrufsbelehrung (ABO-4), Preisanpassung. Empfehlung: vor dem Abo-Start klären.
18. **I18. Impressum.** Ist die BLM-Angabe weiter nötig, und braucht es mit dem geplanten Blog einen Verantwortlichen nach § 18 Abs. 2 MStV? Empfehlung: Anwalt.
