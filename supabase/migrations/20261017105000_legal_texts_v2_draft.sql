-- 20261017105000 Rechtstexte Version 2 als Entwurf (nicht veröffentlicht)
--
-- Zweck: Für Impressum, AGB, Widerrufsbelehrung, Versand und Datenschutzerklärung je eine neue
-- Zeile in legal_document_versions mit version = 2, status = 'draft', effective_from = null.
-- Inhalt: Anpassung der Shopify-Texte an den eigenen Shop (Netlify, Supabase Frankfurt, Stripe mit
-- Klarna und PayPal, Resend, Lexware Office, DHL, Meta/Google/TikTok nur mit Einwilligung,
-- neuer Checkout, Kundenkonto, Newsletter mit Double Opt-in, Pfand). Jede Änderung ist in
-- docs/rechtstexte-aenderungen.md mit Kennung (IM-, AGB-, WI-, VS-, DS-) begründet.
--
-- Nicht enthalten: Abo-Bedingungen und Kündigungsbutton (§ 312k BGB). Sie werden erst mit dem
-- Abo-Start als Version 3 eingespielt (Entwurf in docs/rechtstexte-aenderungen.md, Abschnitt 6).
-- Die LUCID-Nummer steht nicht im Text, sondern kommt aus shop_settings (Seite /pages/impressum).
--
-- Version 1 bleibt unverändert und veröffentlicht. Storefront (src/lib/content/legal.ts) und
-- Checkout (current_legal_version) lesen nur status = 'published'; diese Entwürfe sind also
-- weder auf der Website noch in Bestellmails sichtbar, bis sie ausdrücklich freigegeben werden.
--
-- Idempotent: feste UUIDs, ON CONFLICT DO NOTHING (Unique-Key document_id, locale, version).
-- Eine bereits veröffentlichte oder im Backoffice bearbeitete Version 2 wird nie überschrieben.
--
-- Veröffentlichen (erst nach Freigabe durch Auftraggeber und Anwalt, je Text einzeln, vorher alle
-- [OFFEN]-Marker auflösen; published_at/published_by kommen mit Migration 20261017204200):
--   update public.legal_document_versions
--      set status = 'published', effective_from = '<Zeitpunkt in UTC>',
--          published_at = now(), published_by = '<staff user id>'
--    where id = '<uuid unten>' and status = 'draft';
-- Danach ist die Version unveränderlich (Trigger legal_versions_immutable); Korrekturen = Version 3.
--
-- Rückweg (nur solange die Zeilen Entwürfe sind; auf der Live-Instanz nur mit Freigabe im Chat):
--   delete from public.legal_document_versions
--    where status = 'draft' and version = 2 and id in (
--      'a159146d-ad0b-56b2-8085-c51753b5e025', '49d1ea76-06c4-5e5c-a37e-4fb747cf0b09',
--      '32944460-b857-56f8-be5f-51bb67633644', '94ed7ace-e6dd-5aff-b59d-8bf4803e47c6',
--      'df95682e-3bdd-5eba-8b19-7a5e09b2a827');

-- 1. Impressum ---------------------------------------------------------------------------
insert into public.legal_document_versions
  (id, document_id, locale, version, title, body_html, change_note, status, effective_from)
select 'a159146d-ad0b-56b2-8085-c51753b5e025'::uuid, d.id, 'de', 2, 'Impressum',
$html$<h2>Anbieter</h2>
<p>Gesetzliche Anbieterkennung:</p>
<p>CG Projects UG (haftungsbeschränkt)</p>
<p>Kurt-Viermetz-Straße 1a</p>
<p>86150 Augsburg</p>
<p>Deutschland</p>
<p>vertr. d. d. Geschäftsführer Celine Grimm</p>
<h2>Kontakt</h2>
<p>Telefon: +491629231702</p>
<p>E-Mail: hello@provibe-drinks.de</p>
<h2>Register und Umsatzsteuer</h2>
<p>USt-IdNr.: DE457662597</p>
<p>eingetragen im Handelsregister des Amtsgerichtes Augsburg</p>
<p>Handelsregisternummer HRB 41818</p>
<h2>Aufsichtsbehörde</h2>
<p>zuständige Aufsichtsbehörde für audiovisuelle Mediendienste:</p>
<p>Bayerische Landeszentrale für neue Medien (BLM)</p>
<p>Heinrich-Lübke-Str. 27</p>
<p>81737 München</p>
<p>Internet: <a href="https://www.blm.de/de/startseite.cfm">https://www.blm.de/</a></p>
<h2>Verbraucherstreitbeilegung</h2>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor Verbraucherschlichtungsstellen teilzunehmen.</p>$html$,
'Entwurf Version 2 (17.10.2026): Zeile "Email Marketing" entfernt (IM-1), LUCID als eigener Abschnitt aus shop_settings (IM-2), Gliederung mit H2. Gegenüberstellung: docs/rechtstexte-aenderungen.md. Nicht veröffentlicht, Freigabe durch Auftraggeber und Anwalt ausstehend.',
'draft', null
from public.legal_documents d where d.kind = 'impressum'
on conflict do nothing;

-- 2. AGB und Kundeninformationen ---------------------------------------------------------
insert into public.legal_document_versions
  (id, document_id, locale, version, title, body_html, change_note, status, effective_from)
select '49d1ea76-06c4-5e5c-a37e-4fb747cf0b09'::uuid, d.id, 'de', 2, 'Allgemeine Geschäftsbedingungen',
$html$<p>Allgemeine Geschäftsbedingungen und Kundeninformationen</p>
<h2>I. Allgemeine Geschäftsbedingungen</h2>
<h2>§ 1 Grundlegende Bestimmungen</h2>
<p>(1) Die nachstehenden Geschäftsbedingungen gelten für Verträge, die Sie mit uns als Anbieter (CG Projects UG (haftungsbeschränkt)) über die Internetseite www.provibe-drinks.de/ schließen. Soweit nicht anders vereinbart, wird der Einbeziehung gegebenenfalls von Ihnen verwendeter eigener Bedingungen widersprochen.</p>
<p>(2) Verbraucher im Sinne der nachstehenden Regelungen ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden kann. Unternehmer ist jede natürliche oder juristische Person oder eine rechtsfähige Personengesellschaft, die bei Abschluss eines Rechtsgeschäfts in Ausübung ihrer selbständigen beruflichen oder gewerblichen Tätigkeit handelt.</p>
<h2>§ 2 Zustandekommen des Vertrages</h2>
<p>(1) Gegenstand des Vertrages ist der Verkauf von Waren.</p>
<p>(2) Bereits mit dem Einstellen des jeweiligen Produkts auf unserer Internetseite unterbreiten wir Ihnen ein verbindliches Angebot zum Abschluss eines Vertrages über das Online-Warenkorbsystem zu den in der Artikelbeschreibung angegebenen Bedingungen.</p>
<p>(3) Der Vertrag kommt über das Online-Warenkorbsystem wie folgt zustande:</p>
<p>Die zum Kauf beabsichtigten Waren werden im "Warenkorb" abgelegt. Über die entsprechende Schaltfläche in der Navigationsleiste können Sie den "Warenkorb" aufrufen und dort jederzeit Änderungen vornehmen.</p>
<p>Nach Anklicken der Schaltfläche "Zur Kasse" und der Eingabe der persönlichen Daten (E-Mail-Adresse, Lieferanschrift und gegebenenfalls abweichende Rechnungsanschrift) sowie der Auswahl der Versand- und Zahlungsart werden Ihnen abschließend die Bestelldaten als Bestellübersicht angezeigt. Eine Bestellung ist auch ohne Kundenkonto möglich.</p>
<p>Vor Absenden der Bestellung haben Sie die Möglichkeit, die Angaben in der Bestellübersicht nochmals zu überprüfen, zu ändern (auch über die Funktion "zurück" des Internetbrowsers) bzw. die Bestellung abzubrechen.</p>
<p>Mit dem Absenden der Bestellung über die Schaltfläche "Zahlungspflichtig bestellen" erklären Sie rechtsverbindlich die Annahme des Angebotes, wodurch der Vertrag zustande kommt.</p>
<p>Soweit Sie als Zahlungsart PayPal oder Klarna wählen, werden Sie nach dem Absenden der Bestellung auf die Internetseite des jeweiligen Anbieters weitergeleitet, um die Zahlung dort freizugeben. Gleiches gilt, soweit bei Zahlung per Karte, Apple Pay oder Google Pay eine zusätzliche Bestätigung (z.B. 3-D Secure) erforderlich ist. Anschließend werden Sie in unseren Online-Shop zurückgeleitet.</p>
<p>(4) Die Abwicklung der Bestellung und Übermittlung aller im Zusammenhang mit dem Vertragsschluss erforderlichen Informationen erfolgt per E-Mail zum Teil automatisiert. Sie haben deshalb sicherzustellen, dass die von Ihnen bei uns hinterlegte E-Mail-Adresse zutreffend ist, der Empfang der E-Mails technisch sichergestellt und insbesondere nicht durch SPAM-Filter verhindert wird.</p>
<h2>§ 3 Vertragslaufzeit / Kündigung bei Abonnement-Verträgen</h2>
<p>(1) Der zwischen Ihnen und uns geschlossene Abonnement-Vertrag hat eine unbestimmte Laufzeit. Der Vertrag kann von beiden Parteien mit einer Frist von einem Monat zum Monatsende (soweit im jeweiligen Angebot nichts anderes geregelt ist) gekündigt werden.</p>
<p>(2) Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt hiervon unberührt.</p>
<p>(3) Jede Kündigung muss entweder in Textform (z.B. E-Mail) oder über die auf unserer Internetpräsenz eingebundene Kündigungsschaltfläche (“Verträge hier kündigen” oder ähnliche Bezeichnung) erklärt und übermittelt werden.</p>
<h2>§ 4 Zurückbehaltungsrecht, Eigentumsvorbehalt</h2>
<p>(1) Ein Zurückbehaltungsrecht können Sie nur ausüben, soweit es sich um Forderungen aus demselben Vertragsverhältnis handelt.</p>
<p>(2) Die Ware bleibt bis zur vollständigen Zahlung des Kaufpreises unser Eigentum.</p>
<p>(3) Sind Sie Unternehmer, gilt ergänzend Folgendes:</p>
<p>a) Wir behalten uns das Eigentum an der Ware bis zum vollständigen Ausgleich aller Forderungen aus der laufenden Geschäftsbeziehung vor. Vor Übergang des Eigentums an der Vorbehaltsware ist eine Verpfändung oder Sicherheitsübereignung nicht zulässig.</p>
<p>b) Sie können die Ware im ordentlichen Geschäftsgang weiterverkaufen. Für diesen Fall treten Sie bereits jetzt alle Forderungen in Höhe des Rechnungsbetrages, die Ihnen aus dem Weiterverkauf erwachsen, an uns ab, wir nehmen die Abtretung an. Sie sind weiter zur Einziehung der Forderung ermächtigt. Soweit Sie Ihren Zahlungsverpflichtungen nicht ordnungsgemäß nachkommen, behalten wir uns allerdings vor, die Forderung selbst einzuziehen.</p>
<p>c) Bei Verbindung und Vermischung der Vorbehaltsware erwerben wir Miteigentum an der neuen Sache im Verhältnis des Rechnungswertes der Vorbehaltsware zu den anderen verarbeiteten Gegenständen zum Zeitpunkt der Verarbeitung.</p>
<p>d) Wir verpflichten uns, die uns zustehenden Sicherheiten auf Ihr Verlangen insoweit freizugeben, als der realisierbare Wert unserer Sicherheiten die zu sichernde Forderung um mehr als 10% übersteigt. Die Auswahl der freizugebenden Sicherheiten obliegt uns.</p>
<h2>§ 5 Gewährleistung</h2>
<p>(1) Es bestehen die gesetzlichen Mängelhaftungsrechte.</p>
<p>(2) Als Verbraucher werden Sie gebeten, die Ware bei Lieferung umgehend auf Vollständigkeit, offensichtliche Mängel und Transportschäden zu überprüfen und uns sowie dem Spediteur Beanstandungen schnellstmöglich mitzuteilen. Kommen Sie dem nicht nach, hat dies keine Auswirkung auf Ihre gesetzlichen Gewährleistungsansprüche.</p>
<p>(3) Soweit ein Merkmal der Ware von den objektiven Anforderungen abweicht, gilt die Abweichung nur dann als vereinbart, wenn Sie vor Abgabe der Vertragserklärung durch uns über selbige in Kenntnis gesetzt wurden und die Abweichung ausdrücklich und gesondert zwischen den Vertragsparteien vereinbart wurde.</p>
<p>(4) Soweit Sie Unternehmer sind, gilt abweichend von den vorstehenden Gewährleistungsregelungen:</p>
<p>a) Als Beschaffenheit der Ware gelten nur unsere eigenen Angaben und die Produktbeschreibung des Herstellers als vereinbart, nicht jedoch sonstige Werbung, öffentliche Anpreisungen und Äußerungen des Herstellers.</p>
<p>b) Bei Mängeln leisten wir nach unserer Wahl Gewähr durch Nachbesserung oder Nachlieferung. Schlägt die Mangelbeseitigung fehl, können Sie nach Ihrer Wahl Minderung verlangen oder vom Vertrag zurücktreten. Die Mängelbeseitigung gilt nach erfolglosem zweiten Versuch als fehlgeschlagen, wenn sich nicht insbesondere aus der Art der Ware oder des Mangels oder den sonstigen Umständen etwas anderes ergibt. Im Falle der Nachbesserung müssen wir nicht die erhöhten Kosten tragen, die durch die Verbringung der Ware an einen anderen Ort als den Erfüllungsort entstehen, sofern die Verbringung nicht dem bestimmungsgemäßen Gebrauch der Ware entspricht.</p>
<p>c) Die Gewährleistungsfrist beträgt ein Jahr ab Ablieferung der Ware. Die Fristverkürzung gilt nicht:</p>
<ul>
<li>für uns zurechenbare schuldhaft verursachte Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit und bei vorsätzlich oder grob fahrlässig verursachten sonstigen Schäden;</li>
<li>soweit wir den Mangel arglistig verschwiegen oder eine Garantie für die Beschaffenheit der Sache übernommen haben;</li>
<li>bei Sachen, die entsprechend ihrer üblichen Verwendungsweise für ein Bauwerk verwendet worden sind und dessen Mangelhaftigkeit verursacht haben;</li>
<li>bei gesetzlichen Rückgriffsansprüchen, die Sie im Zusammenhang mit Mängelrechten gegen uns haben.</li>
</ul>
<h2>§ 6 Rechtswahl, Erfüllungsort, Gerichtsstand</h2>
<p>(1) Es gilt deutsches Recht. Bei Verbrauchern gilt diese Rechtswahl nur, soweit hierdurch der durch zwingende Bestimmungen des Rechts des Staates des gewöhnlichen Aufenthaltes des Verbrauchers gewährte Schutz nicht entzogen wird (Günstigkeitsprinzip).</p>
<p>(2) Erfüllungsort für alle Leistungen aus den mit uns bestehenden Geschäftsbeziehungen sowie Gerichtsstand ist unser Sitz, soweit Sie nicht Verbraucher, sondern Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen sind. Dasselbe gilt, wenn Sie keinen allgemeinen Gerichtsstand in Deutschland oder der EU haben oder der Wohnsitz oder gewöhnliche Aufenthalt im Zeitpunkt der Klageerhebung nicht bekannt ist. Die Befugnis, auch das Gericht an einem anderen gesetzlichen Gerichtsstand anzurufen, bleibt hiervon unberührt.</p>
<p>(3) Die Bestimmungen des UN-Kaufrechts finden ausdrücklich keine Anwendung.</p>
<h2>II. Kundeninformationen</h2>
<h3>1. Identität des Verkäufers</h3>
<p>CG Projects UG (haftungsbeschränkt)<br>Kurt-Viermetz-Straße 1a<br>86150 Augsburg<br>Deutschland<br>Telefon: +491629231702<br>E-Mail: hello@provibe-drinks.de</p>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor Verbraucherschlichtungsstellen teilzunehmen.</p>
<h3>2. Informationen zum Zustandekommen des Vertrages</h3>
<p>Die technischen Schritte zum Vertragsschluss, der Vertragsschluss selbst und die Korrekturmöglichkeiten erfolgen nach Maßgabe der Regelungen "Zustandekommen des Vertrages" unserer Allgemeinen Geschäftsbedingungen (Teil I.).</p>
<h3>3. Vertragssprache, Vertragstextspeicherung</h3>
<p>3.1. Vertragssprache ist deutsch.</p>
<p>3.2. Der Vertragstext wird von uns gespeichert, ist Ihnen nach Vertragsschluss jedoch nicht über das Internet zugänglich. Soweit Sie ein Kundenkonto angelegt haben, können Sie die Bestelldaten dort einsehen. Vor Absenden der Bestellung über das Online-Warenkorbsystem können die Vertragsdaten über die Druckfunktion des Browsers ausgedruckt oder elektronisch gesichert werden. Nach Zugang der Bestellung bei uns werden die Bestelldaten, die gesetzlich vorgeschriebenen Informationen bei Fernabsatzverträgen und die Allgemeinen Geschäftsbedingungen nochmals per E-Mail an Sie übersandt.</p>
<h3>4. Wesentliche Merkmale der Ware oder Dienstleistung</h3>
<p>Die wesentlichen Merkmale der Ware und/oder Dienstleistung finden sich im jeweiligen Angebot.</p>
<h3>5. Preise und Zahlungsmodalitäten</h3>
<p>5.1. Die in den jeweiligen Angeboten angeführten Preise sowie die Versandkosten stellen Gesamtpreise dar. Sie beinhalten alle Preisbestandteile einschließlich aller anfallenden Steuern.</p>
<p>5.2. Die anfallenden Versandkosten sind nicht im Kaufpreis enthalten. Sie sind über eine entsprechend bezeichnete Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot aufrufbar, werden im Laufe des Bestellvorganges gesondert ausgewiesen und sind von Ihnen zusätzlich zu tragen, soweit nicht die versandkostenfreie Lieferung zugesagt ist.</p>
<p>5.3. Die Ihnen zur Verfügung stehenden Zahlungsarten sind unter einer entsprechend bezeichneten Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot ausgewiesen.</p>
<p>5.4. Soweit bei den einzelnen Zahlungsarten nicht anders angegeben, sind die Zahlungsansprüche aus dem geschlossenen Vertrag sofort zur Zahlung fällig.</p>
<p>5.5. Für Getränke in pfandpflichtigen Einweggetränkeverpackungen fällt ein Pfand in der im jeweiligen Angebot angegebenen Höhe an (derzeit 0,25 € je Dose). Das Pfand wird gesondert ausgewiesen und in der Bestellübersicht als eigene Position aufgeführt. Der Grundpreis wird ohne Pfand berechnet.</p>
<h3>6. Lieferbedingungen</h3>
<p>6.1. Die Lieferbedingungen, der Liefertermin sowie gegebenenfalls bestehende Lieferbeschränkungen finden sich unter einer entsprechend bezeichneten Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot.</p>
<p>6.2. Soweit Sie Verbraucher sind, ist gesetzlich geregelt, dass die Gefahr des zufälligen Untergangs und der zufälligen Verschlechterung der verkauften Sache während der Versendung erst mit der Übergabe der Ware an Sie übergeht, unabhängig davon, ob die Versendung versichert oder unversichert erfolgt. Dies gilt nicht, wenn Sie eigenständig ein nicht vom Unternehmer benanntes Transportunternehmen oder eine sonst zur Ausführung der Versendung bestimmte Person beauftragt haben.</p>
<p>Sind Sie Unternehmer, erfolgt die Lieferung und Versendung auf Ihre Gefahr.</p>
<h3>7. Gesetzliches Mängelhaftungsrecht</h3>
<p>Die Mängelhaftung richtet sich nach der Regelung "Gewährleistung" in unseren Allgemeinen Geschäftsbedingungen (Teil I).</p>
<h3>8. Vertragslaufzeit / Kündigung</h3>
<p>Informationen zur Laufzeit des Vertrages sowie den Kündigungsbedingungen finden Sie in der Regelung "Vertragslaufzeit / Kündigung bei Abonnement-Verträgen" in unseren Allgemeinen Geschäftsbedingungen (Teil I) sowie im jeweiligen Angebot.</p>
<p>Diese AGB und Kundeninformationen wurden von den auf IT-Recht spezialisierten Juristen des Händlerbundes erstellt und werden permanent auf Rechtskonformität geprüft. Die Händlerbund Management AG garantiert für die Rechtssicherheit der Texte und haftet im Falle von Abmahnungen. Nähere Informationen dazu finden Sie unter: <a href="https://www.haendlerbund.de/de/leistungen/rechtssicherheit/agb-service">https://www.haendlerbund.de/de/leistungen/rechtssicherheit/agb-service</a>.</p>$html$,
'Entwurf Version 2 (17.10.2026): Bestellablauf an den eigenen Checkout angepasst (AGB-1 bis AGB-3), Vertragstextspeicherung (AGB-4), Pfand und Grundpreis (AGB-5), Gliederung mit H2/H3. Abo-Regelung § 3 unverändert, Präzisierung erst mit Abo-Start. Gegenüberstellung: docs/rechtstexte-aenderungen.md. Nicht veröffentlicht, Freigabe durch Auftraggeber und Anwalt ausstehend.',
'draft', null
from public.legal_documents d where d.kind = 'agb'
on conflict do nothing;

-- 3. Widerrufsbelehrung ------------------------------------------------------------------
insert into public.legal_document_versions
  (id, document_id, locale, version, title, body_html, change_note, status, effective_from)
select '32944460-b857-56f8-be5f-51bb67633644'::uuid, d.id, 'de', 2, 'Rückgabe- und Widerrufsbelehrung',
$html$<p>Widerrufsrecht für den Verkauf von Waren</p>
<h2>Widerrufsrecht für Verbraucher</h2>
<p>(Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbstständigen beruflichen Tätigkeit zugerechnet werden können.)</p>
<h3>Widerrufsbelehrung</h3>
<h2>Widerrufsrecht</h2>
<p>Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
<p>Die Widerrufsfrist beträgt 14 Tage ab dem Tag,</p>
<ul>
<li>an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat, sofern Sie eine oder mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese einheitlich geliefert wird bzw. werden;</li>
<li>an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die letzte Ware in Besitz genommen haben bzw. hat, sofern Sie mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese getrennt geliefert werden;</li>
<li>an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die erste Ware in Besitz genommen haben bzw. hat, sofern im Rahmen einer Bestellung Waren zur regelmäßigen Lieferung über einen festgelegten Zeitraum hinweg geliefert werden.</li>
</ul>
<p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Telefonnr.: +491629231702, E-Mail-Adresse: support@provibe-drinks.de) mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
<p>Sie können das Muster-Widerrufsformular oder eine andere eindeutige Erklärung auch auf unserer Webseite <a href="https://www.provibe-drinks.de/pages/widerruf-formular">https://www.provibe-drinks.de/pages/widerruf-formular</a> ("Vertrag widerrufen") elektronisch ausfüllen und übermitteln. Machen Sie von dieser Möglichkeit Gebrauch, so werden wir Ihnen unverzüglich (z. B. per E-Mail) eine Bestätigung über den Eingang eines solchen Widerrufs übermitteln.</p>
<p>Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.</p>
<h2>Folgen des Widerrufs</h2>
<p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen 14 Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.</p>
<p>Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.</p>
<p>Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen 14 Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von 14 Tagen absenden.</p>
<p>Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.</p>
<p>Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.</p>
<h2>Ausschluss- bzw. Erlöschensgründe</h2>
<p>Das Widerrufsrecht besteht nicht bei Verträgen</p>
<ul>
<li>zur Lieferung von Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind;</li>
<li>zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde;</li>
<li>zur Lieferung alkoholischer Getränke, deren Preis bei Vertragsschluss vereinbart wurde, die aber frühestens 30 Tage nach Vertragsschluss geliefert werden können und deren aktueller Wert von Schwankungen auf dem Markt abhängt, auf die der Unternehmer keinen Einfluss hat;</li>
<li>zur Lieferung von Zeitungen, Zeitschriften oder Illustrierten mit Ausnahme von Abonnement-Verträgen.</li>
</ul>
<p>Das Widerrufsrecht erlischt vorzeitig bei Verträgen</p>
<ul>
<li>zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde;</li>
<li>zur Lieferung von Waren, wenn diese nach der Lieferung aufgrund ihrer Beschaffenheit untrennbar mit anderen Gütern vermischt wurden;</li>
<li>zur Lieferung von Ton- oder Videoaufnahmen oder Computersoftware in einer versiegelten Packung, wenn die Versiegelung nach der Lieferung entfernt wurde.</li>
</ul>
<h2>Muster-Widerrufsformular</h2>
<p>(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
<ul>
<li>An CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, E-Mail-Adresse: support@provibe-drinks.de:</li>
<li>Hiermit widerrufe(n) ich/ wir (*) den von mir/ uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/ die Erbringung der folgenden Dienstleistung (*)</li>
<li>Bestellt am (*)/ erhalten am (*)</li>
<li>Name des/ der Verbraucher(s)</li>
<li>Anschrift des/ der Verbraucher(s)</li>
<li>Unterschrift des/ der Verbraucher(s) (nur bei Mitteilung auf Papier)</li>
<li>Datum</li>
</ul>
<p>(*) Unzutreffendes streichen.</p>$html$,
'Entwurf Version 2 (17.10.2026): Hinweis auf die elektronische Widerrufsfunktion mit Eingangsbestätigung (WI-1), Rücksendeadresse Bei St Ursula 16a entfernt, Rücksendung an die Anschrift oben laut Annahme H5 (WI-2), Listen zusammengeführt. Gegenüberstellung: docs/rechtstexte-aenderungen.md. Nicht veröffentlicht, Freigabe durch Auftraggeber und Anwalt ausstehend.',
'draft', null
from public.legal_documents d where d.kind = 'widerruf'
on conflict do nothing;

-- 4. Versand und Zahlung -----------------------------------------------------------------
insert into public.legal_document_versions
  (id, document_id, locale, version, title, body_html, change_note, status, effective_from)
select '94ed7ace-e6dd-5aff-b59d-8bf4803e47c6'::uuid, d.id, 'de', 2, 'Versand',
$html$<p>Zahlung und Versand</p>
<p>Es gelten folgende Bedingungen:</p>
<p>Die Lieferung erfolgt nur im Inland (Deutschland).</p>
<h2>Versandkosten (inklusive gesetzliche Mehrwertsteuer)</h2>
<p>Wir berechnen die Versandkosten pauschal mit 4,90 € pro Bestellung.</p>
<p>Ab einem Warenwert von 50,00 € liefern wir versandkostenfrei. Maßgeblich ist der Warenwert nach Abzug eines Rabatts und ohne Pfand.</p>
<h2>Lieferfristen</h2>
<p>Soweit im jeweiligen Angebot keine andere Frist angegeben ist, erfolgt die Lieferung der Ware im Inland (Deutschland) innerhalb von 3 - 5 Werktagen nach Vertragsschluss (bei vereinbarter Vorauszahlung nach dem Zeitpunkt Ihrer Zahlungsanweisung).</p>
<p>Beachten Sie, dass an Sonn- und Feiertagen keine Zustellung erfolgt.</p>
<p>Haben Sie Artikel mit unterschiedlichen Lieferzeiten bestellt, wird die Ware in einer gemeinsamen Sendung versandt, sofern wir keine abweichenden Vereinbarungen mit Ihnen getroffen haben. Die Lieferzeit bestimmt sich in diesem Fall nach dem Artikel mit der längsten Lieferzeit den Sie bestellt haben.</p>
<p>Der Versand erfolgt mit DHL.</p>
<h2>Akzeptierte Zahlungsmöglichkeiten</h2>
<ul>
<li>Zahlung per Karte (Visa, Mastercard, Maestro, American Express)</li>
<li>Zahlung per Apple Pay</li>
<li>Zahlung per Google Pay</li>
<li>Zahlung per PayPal</li>
<li>Zahlung per Klarna</li>
</ul>
<h2>Weitere Einzelheiten zur Zahlung</h2>
<p>Die Zahlungen werden über den Zahlungsdienstleister Stripe abgewickelt.</p>
<p>Bei Zahlung per Karte, Apple Pay oder Google Pay erfolgt die Belastung Ihres Kartenkontos mit Vertragsschluss.</p>
<p>Bei Zahlung per PayPal werden Sie nach dem Absenden der Bestellung zu PayPal weitergeleitet und bestätigen dort die Zahlungsanweisung an uns. Weitere Hinweise erhalten Sie im Bestellvorgang.</p>
<p>Bei Zahlung per Klarna werden Sie nach dem Absenden der Bestellung zu Klarna weitergeleitet und wählen dort unter den Ihnen angebotenen Klarna-Zahlungsoptionen. Es gelten ergänzend die Bedingungen von Klarna, die Ihnen dort angezeigt werden.</p>
<p>Bei Fragen finden Sie unsere Kontaktdaten im Impressum.</p>$html$,
'Entwurf Version 2 (17.10.2026): Grundlage der Versandkostenfreiheit (VS-1), Pre-Sale-Satz entfernt (VS-2, Annahme H7), Versand mit DHL (VS-3), Zahlarten über Stripe statt Kreditkarte, PayPal, Banküberweisung (VS-4, VS-5). Gegenüberstellung: docs/rechtstexte-aenderungen.md. Nicht veröffentlicht, Freigabe durch Auftraggeber und Anwalt ausstehend.',
'draft', null
from public.legal_documents d where d.kind = 'versand'
on conflict do nothing;

-- 5. Datenschutzerklärung ----------------------------------------------------------------
insert into public.legal_document_versions
  (id, document_id, locale, version, title, body_html, change_note, status, effective_from)
select 'df95682e-3bdd-5eba-8b19-7a5e09b2a827'::uuid, d.id, 'de', 2, 'Datenschutzerklärung',
$html$<p>Die CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg („provibe“, „wir“) betreibt diesen Shop und diese Website, einschließlich aller zugehörigen Informationen, Inhalte, Funktionen, Tools, Produkte und Services, um Ihnen als Kunde ein individuelles Einkaufserlebnis bereitzustellen (die „Services“). Für den Betrieb der Services setzen wir die im Abschnitt „Dienstleister und Empfänger“ genannten Dienstleister ein. In dieser Datenschutzerklärung wird beschrieben, wie wir personenbezogene Daten erfassen, verwenden oder weitergeben, wenn Sie die Website besuchen, nutzen oder einen Kauf oder eine andere Transaktion unter Verwendung der Services tätigen oder anderweitig mit uns kommunizieren. Wenn es einen Konflikt zwischen unseren allgemeinen Geschäftsbedingungen und dieser Datenschutzerklärung gibt, hat diese Datenschutzerklärung Vorrang in Bezug auf die Erfassung, Verarbeitung und Weitergabe Ihrer personenbezogenen Daten.</p>
<p>Lesen Sie sich diese Datenschutzerklärung bitte sorgfältig durch. Auf welcher Rechtsgrundlage wir Ihre Daten jeweils verarbeiten, erläutern wir in den einzelnen Abschnitten und im Abschnitt „Rechtsgrundlagen“. Soweit eine Verarbeitung auf Ihrer Einwilligung beruht, holen wir diese gesondert ein; die bloße Nutzung der Services gilt nicht als Einwilligung.</p>
<h2>Welche personenbezogenen Daten erfassen oder verarbeiten wir?</h2>
<p>Wenn wir den Begriff „personenbezogene Daten“ verwenden, beziehen wir uns auf Informationen, die Sie oder eine andere Person identifizieren oder unmittelbar mit Ihnen in Verbindung gebracht werden können. Personenbezogene Daten umfassen keine Informationen, die anonym erfasst oder so anonymisiert wurden, dass eine Identifizierung oder eine Zuordnung zu Ihrer Person nicht möglich ist. Je nachdem, wie Sie mit den Services interagieren, wo Sie wohnen und wie es das geltende Recht erlaubt oder vorschreibt, können wir die folgenden Kategorien personenbezogener Daten erfassen oder verarbeiten, einschließlich der aus diesen personenbezogenen Daten gezogenen Rückschlüsse:</p>
<ul>
<li><strong>Kontaktdaten</strong> einschließlich Name, Postanschrift, Rechnungsadresse, Lieferadresse, Telefonnummer und E-Mail-Adresse.</li>
<li><strong>Zahlungsdaten</strong> einschließlich Zahlungsart, Transaktionsdetails, Zahlungsbestätigung und andere Zahlungsdetails; bei Kartenzahlungen erhalten wir nur die Kartenmarke und die letzten vier Ziffern der Kartennummer. Vollständige Karten- und Kontodaten geben Sie direkt bei unserem Zahlungsdienstleister Stripe beziehungsweise bei PayPal oder Klarna ein; sie werden nicht auf unseren Systemen gespeichert.</li>
<li><strong>Kontoinformationen</strong> darunter E-Mail-Adresse, Passwort (nur als verschlüsselter Hashwert gespeichert und nur, wenn Sie ein Passwort festlegen), Konfigurationen und Einstellungen.</li>
<li><strong>Transaktionsinformationen</strong> einschließlich der Artikel, die Sie sich ansehen, in den Warenkorb legen oder kaufen, zurückgeben, umtauschen oder stornieren, sowie Ihre vergangenen Transaktionen.</li>
<li><strong>Kommunikation mit uns</strong> einschließlich der Informationen, die Sie bei der Kommunikation mit uns angeben, beispielsweise wenn Sie eine Anfrage an den Kundensupport senden.</li>
<li><strong>Geräteinformationen</strong> einschließlich Informationen über Gerät, Browser oder Netzwerkverbindung, IP-Adresse und andere eindeutige Identifikatoren.</li>
<li><strong>Nutzungsinformationen</strong> einschließlich Informationen über Ihre Interaktion mit den Services, auch darüber, wie und wann Sie mit den Services interagieren oder sie durchsuchen.</li>
<li><strong>Einwilligungsdaten</strong> einschließlich Ihrer Auswahl im Cookie-Banner sowie, bei der Newsletter-Anmeldung, Zeitpunkt, IP-Adresse und Wortlaut Ihrer Einwilligung.</li>
</ul>
<h2>Quellen von personenbezogenen Daten</h2>
<p>Wir können personenbezogene Daten über die folgenden Quellen erfassen:</p>
<ul>
<li><strong>Direkt von Ihnen.</strong> Wir erfassen die Daten unter anderem, wenn Sie ein Konto erstellen, die Services aufrufen oder nutzen, mit uns kommunizieren oder uns anderweitig Ihre personenbezogenen Daten zur Verfügung stellen.</li>
<li><strong>Automatisch über die Services.</strong> Wir erfassen die Daten unter anderem von Ihrem Gerät oder wenn Sie unsere Produkte oder Services nutzen oder unsere Website besuchen sowie über die Verwendung von Cookies und ähnlichen Technologien.</li>
<li><strong>Von unseren Dienstanbietern.</strong> Wir erfassen die Daten unter anderem, wenn wir die Dienstanbieter beauftragen, bestimmte Technologien zu aktivieren, und wenn sie Ihre personenbezogenen Daten in unserem Auftrag erfassen oder verarbeiten.</li>
<li>Von unseren Partnern und anderen Drittanbietern</li>
</ul>
<h2>Wie verwenden wir Ihre personenbezogenen Daten?</h2>
<p>Je nachdem, wie Sie mit uns interagieren oder welche der Services Sie nutzen, können wir personenbezogene Daten für die folgenden Zwecke verwenden:</p>
<ul>
<li><strong>Bereitstellung, Anpassung und Verbesserung der Services.</strong> Wir verwenden Ihre personenbezogenen Daten, um Ihnen die Services bereitzustellen. Das umfasst unter anderem die Erfüllung unseres Vertrags mit Ihnen, die Verarbeitung Ihrer Zahlungen, die Ausführung Ihrer Bestellungen, die Speicherung Ihrer Konfigurationen und der Artikel, für die Sie sich interessieren, die Versendung von Benachrichtigungen im Zusammenhang mit Ihrem Konto, die Erstellung, Pflege und sonstige Verwaltung Ihres Kontos, die Organisation des Versands, die Erleichterung von Rückgaben und Umtausch, die Möglichkeit, dass Sie Bewertungen abgeben, und die Schaffung eines individuellen Einkaufserlebnisses für Sie, indem wir Ihnen beispielsweise Produkte empfehlen, die sich an Ihren Käufen orientieren. Dazu kann auch die Verwendung Ihrer personenbezogenen Daten gehören, um die Services besser anzupassen und zu verbessern.</li>
<li><strong>Marketing und Werbung.</strong> Wir verwenden Ihre personenbezogenen Daten für Marketing- und Werbezwecke, um beispielsweise Marketing- und Werbemitteilungen per E-Mail, SMS oder Post zu versenden und Ihnen online Werbung für Produkte oder Leistungen für die Services oder andere Websites anzuzeigen, auch auf der Grundlage von Artikeln, die Sie zuvor gekauft oder in Ihren Warenkorb gelegt haben, sowie anderen Aktivitäten in Bezug auf die Services. Werbe-E-Mails senden wir nur mit Ihrer Einwilligung (siehe Abschnitt „Newsletter“), Online-Werbung auf Grundlage Ihrer Aktivitäten nur nach Ihrer Einwilligung im Cookie-Banner (siehe Abschnitt „Cookies, Einwilligung und Tracking“).</li>
<li><strong>Sicherheit und Betrugsprävention.</strong> Wir verwenden Ihre personenbezogenen Daten, um Ihr Konto zu authentifizieren, ein sicheres Zahlungs- und Einkaufserlebnis bereitzustellen, mögliche betrügerische, illegale, unsichere oder böswillige Aktivitäten aufzudecken, zu untersuchen oder Maßnahmen zu ergreifen, die öffentliche Sicherheit zu schützen und für die Sicherheit unserer Services zu sorgen. Wenn Sie sich entscheiden, die Services zu nutzen und ein Konto zu registrieren, sind Sie dafür verantwortlich, Ihre Kontoanmeldedaten zu schützen. Wir empfehlen dringend, dass Sie Ihren Benutzernamen, Ihr Passwort oder andere Zugangsdaten nicht an andere Personen weiterzugeben.</li>
<li><strong>Kommunikation mit Ihnen.</strong> Wir verwenden Ihre personenbezogenen Daten, um Ihnen Kundensupport und effektive Services bereitzustellen, zeitnah auf Ihre Anfragen zu reagieren und unsere Geschäftsbeziehung mit Ihnen aufrechtzuerhalten.</li>
<li><strong>Rechtliche Gründe.</strong> Wir verwenden Ihre personenbezogenen Daten, um geltendes Recht einzuhalten oder auf rechtmäßige Verfahrensschritte zu reagieren, einschließlich Anfragen von Strafverfolgungs- oder Aufsichtsbehörden, um zivilrechtliche Ermittlungen, potenzielle oder konkrete Rechtsstreitigkeiten oder andere kontradiktorische Verfahren zu untersuchen oder daran teilzunehmen und um potenzielle Verstöße gegen unsere Bedingungen oder Richtlinien zu untersuchen oder die Bedingungen und Richtlinien durchzusetzen.</li>
</ul>
<h2>Wie geben wir personenbezogene Daten weiter?</h2>
<p>Unter bestimmten Umständen können wir Ihre personenbezogenen Daten für legitime Zwecke gemäß dieser Datenschutzerklärung an Dritte weitergeben. Solche Umstände können Folgendes umfassen:</p>
<ul>
<li>An Anbieter und andere Dritte, die in unserem Auftrag Services erbringen (z. B. Hosting, Datenbank, Zahlungsabwicklung, E-Mail-Versand, Rechnungsstellung, Versand). Diese Dienstleister sind im Abschnitt „Dienstleister und Empfänger“ einzeln aufgeführt.</li>
<li>Wir geben personenbezogene Daten an Geschäfts- und Marketingpartner (Meta, Google und TikTok) weiter, die für Sie Marketingservices erbringen und Ihnen Werbung anzeigen, jedoch nur, wenn Sie hierin über unser Cookie-Banner eingewilligt haben (siehe Abschnitt „Cookies, Einwilligung und Tracking“). Unsere Geschäfts- und Marketingpartner verwenden Ihre Daten gemäß ihren eigenen Datenschutzerklärungen. Je nach Ihrem Wohnort haben Sie möglicherweise das Recht, uns anzuweisen, keine Informationen über Sie weiterzugeben, um Ihnen gezielte Werbung und Marketing auf der Grundlage Ihrer Online-Aktivitäten bei verschiedenen Händlern und Websites anzuzeigen.</li>
<li>Wenn Sie uns auffordern oder anderweitig Ihre Zustimmung geben, bestimmte Informationen an Dritte weiterzugeben, beispielsweise um Ihnen Produkte zu liefern, oder wenn Sie Social-Media-Widgets oder Login-Integrationen nutzen.</li>
<li>Wir geben personenbezogene Daten an unsere Affiliates oder anderweitig innerhalb unserer Unternehmensgruppe weiter.</li>
<li>Im Zusammenhang mit einer geschäftlichen Transaktion wie einer Fusion oder Insolvenz, zur Einhaltung geltender gesetzlicher Verpflichtungen (einschließlich der Reaktion auf Vorladungen, Durchsuchungsbeschlüsse und ähnliche Anfragen), zur Durchsetzung geltender Servicebedingungen oder Richtlinien und zum Schutz oder zur Verteidigung der Services, unserer Rechte und der Rechte unserer Nutzer oder anderer.</li>
</ul>
<h2>Dienstleister und Empfänger</h2>
<p>Für den Betrieb der Services setzen wir die folgenden Dienstleister ein. Soweit sie personenbezogene Daten in unserem Auftrag verarbeiten, haben wir mit ihnen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO geschlossen. Zu Übermittlungen in Länder außerhalb des Europäischen Wirtschaftsraums siehe Abschnitt „Internationale Übertragungen“.</p>
<h3>Hosting und Auslieferung der Website: Netlify</h3>
<p>Unsere Website wird bei Netlify, Inc. (USA) gehostet und über dessen Content Delivery Network ausgeliefert. Netlify führt auch unsere serverseitigen Funktionen aus, zum Beispiel die Annahme von Bestellungen und die Verarbeitung von Formularen. Beim Aufruf der Website verarbeitet Netlify technisch notwendige Daten wie IP-Adresse, Datum und Uhrzeit des Abrufs, aufgerufene Seite, übertragene Datenmenge sowie Browser und Betriebssystem (Server-Logfiles). Schriftarten laden wir von unserem eigenen Server; eine Verbindung zu Google Fonts findet nicht statt. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und zuverlässigen Bereitstellung der Website (Art. 6 Abs. 1 lit. f DSGVO) und, soweit Sie bestellen, die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO).</p>
<h3>Datenbank, Kundenkonto und Dateiablage: Supabase</h3>
<p>Bestell-, Kunden- und Kontodaten speichern wir in einer Datenbank der Supabase Inc. (USA). Datenbank und Dateiablage (zum Beispiel für Rechnungen im PDF-Format) befinden sich in einem Rechenzentrum in Frankfurt am Main (EU). Supabase stellt außerdem die Anmeldung zum Kundenkonto bereit (Anmeldelink per E-Mail oder Passwort). Rechtsgrundlage ist die Erfüllung des Vertrags und die Bereitstellung des Kundenkontos (Art. 6 Abs. 1 lit. b DSGVO) sowie die Erfüllung gesetzlicher Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO).</p>
<h3>Zahlungsabwicklung: Stripe, PayPal und Klarna</h3>
<p>Zahlungen wickeln wir über die Stripe Payments Europe, Ltd. (Irland) ab. Wenn Sie per Karte, Apple Pay oder Google Pay zahlen, geben Sie Ihre Zahlungsdaten in ein von Stripe bereitgestelltes Eingabefeld ein; wir erhalten von Stripe nur die für die Bestellung erforderlichen Angaben, zum Beispiel Zahlungsstatus, Kartenmarke und die letzten vier Ziffern. Stripe verarbeitet die Daten auch zur Betrugsprävention. Bei Apple Pay und Google Pay gelten zusätzlich die Datenschutzbestimmungen von Apple beziehungsweise Google.</p>
<p>Wenn Sie PayPal oder Klarna wählen, werden Sie zum jeweiligen Anbieter weitergeleitet. Dabei erhalten die PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) beziehungsweise die Klarna Bank AB (publ) (Schweden) die für die Zahlung erforderlichen Daten, zum Beispiel Name, Anschrift, E-Mail-Adresse und Bestellbetrag, und verarbeiten sie in eigener Verantwortung nach ihren eigenen Datenschutzhinweisen, die Ihnen dort angezeigt werden.</p>
<p>Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO), für die Betrugsprävention unser berechtigtes Interesse an sicheren Zahlungen (Art. 6 Abs. 1 lit. f DSGVO).</p>
<h3>E-Mail-Versand: Resend</h3>
<p>Bestellbestätigungen, Rechnungen, Mitteilungen zum Kundenkonto, Bestätigungen von Widerrufen und Anfragen sowie den Newsletter versenden wir über den Dienst Resend, einen Anbieter mit Sitz in den USA. Dabei werden Ihre E-Mail-Adresse, der Inhalt der E-Mail und Informationen zur Zustellung verarbeitet. Rechtsgrundlage ist bei Mitteilungen zu Bestellung und Konto die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO), beim Newsletter Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).</p>
<h3>Rechnungen: Lexware Office</h3>
<p>Rechnungen erstellen wir mit Lexware Office der Haufe-Lexware GmbH &amp; Co. KG (Freiburg, Deutschland). Dazu übermitteln wir Name, Rechnungsanschrift, E-Mail-Adresse und die Positionen Ihrer Bestellung. Rechtsgrundlage ist die Erfüllung des Vertrags und unserer steuerrechtlichen Pflichten (Art. 6 Abs. 1 lit. b und c DSGVO).</p>
<h3>Versand: DHL</h3>
<p>Für die Zustellung übermitteln wir Ihren Namen und Ihre Lieferanschrift an die DHL Paket GmbH (Bonn, Deutschland). Ihre E-Mail-Adresse und Telefonnummer geben wir nicht an DHL weiter. Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO).</p>
<h2>Kundenkonto</h2>
<p>Sie können ohne Kundenkonto bestellen. Legen Sie freiwillig ein Kundenkonto an, speichern wir Ihre E-Mail-Adresse, Ihren Namen, gespeicherte Adressen und Ihre Newsletter-Einstellung und ordnen Ihrem Konto Ihre Bestellungen zu, auch frühere Bestellungen, die Sie mit derselben E-Mail-Adresse ohne Konto aufgegeben haben. Die Anmeldung erfolgt über einen Anmeldelink per E-Mail oder mit einem Passwort. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.</p>
<p>Sie können Ihr Kundenkonto jederzeit selbst im Kundenkonto unter „Deine Daten“ löschen. Dabei löschen wir Ihre Zugangsdaten und gespeicherten Adressen, entfernen Name, Telefonnummer und E-Mail-Adresse aus Ihrem Kundenprofil und melden Sie vom Newsletter ab. Bestellungen und Rechnungen einschließlich der darin enthaltenen Angaben bewahren wir wegen gesetzlicher Aufbewahrungspflichten (insbesondere § 147 AO und § 257 HGB) bis zum Ablauf der jeweiligen Frist auf und verwenden sie nur noch zu diesem Zweck (Art. 6 Abs. 1 lit. c DSGVO).</p>
<h2>Newsletter</h2>
<p>Wenn Sie unseren Newsletter abonnieren, im Fußbereich der Website oder bei Ihrer Bestellung, senden wir Ihnen zunächst eine E-Mail mit einem Bestätigungslink (Double-Opt-in). Erst wenn Sie diesen Link anklicken, nehmen wir Sie in den Verteiler auf. Zum Nachweis Ihrer Einwilligung speichern wir den Zeitpunkt der Anmeldung und der Bestätigung, die IP-Adresse und den Browser bei der Bestätigung sowie den Wortlaut der Einwilligung. Für Anmeldungen aus unserem früheren Shop übernehmen wir den dort gespeicherten Anmeldestatus und Zeitpunkt.</p>
<p>Rechtsgrundlage für den Versand ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), für die Speicherung des Nachweises unser berechtigtes Interesse, die Einwilligung belegen zu können (Art. 6 Abs. 1 lit. f DSGVO in Verbindung mit Art. 7 Abs. 1 DSGVO). Sie können den Newsletter jederzeit abbestellen, über den Abmeldelink in jeder Newsletter-E-Mail oder in Ihrem Kundenkonto. Nach der Abmeldung vermerken wir Ihre E-Mail-Adresse als abgemeldet, damit Sie keine weiteren Newsletter erhalten.</p>
<h2>Kontaktformulare und Widerruf</h2>
<p>Wenn Sie uns über das Kontakt-, Partner- oder Widerrufsformular oder per E-Mail schreiben, verarbeiten wir Ihre Angaben (zum Beispiel Name, E-Mail-Adresse, Telefonnummer, Bestellnummer und Nachricht), um Ihr Anliegen zu bearbeiten. Zum Schutz vor Missbrauch speichern wir dabei kurzzeitig einen pseudonymisierten (gehashten) Wert Ihrer IP-Adresse. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit Ihr Anliegen einen Vertrag mit uns betrifft, bei einem Widerruf zusätzlich Art. 6 Abs. 1 lit. c DSGVO, im Übrigen unser berechtigtes Interesse an der Beantwortung von Anfragen (Art. 6 Abs. 1 lit. f DSGVO).</p>
<h2>Cookies, Einwilligung und Tracking</h2>
<p>Wir verwenden Cookies und vergleichbare Technologien. Technisch notwendige Cookies setzen wir ohne Einwilligung ein, weil sie für die von Ihnen gewünschten Funktionen unbedingt erforderlich sind (§ 25 Abs. 2 Nr. 2 TDDDG; Art. 6 Abs. 1 lit. b und f DSGVO):</p>
<ul>
<li>Warenkorb (pv_cart): speichert eine zufällige Kennung Ihres Warenkorbs, Speicherdauer 90 Tage.</li>
<li>Anmeldung (sb-…): hält Sie im Kundenkonto angemeldet, bis Sie sich abmelden oder die Sitzung abläuft.</li>
<li>Formularbestätigung (pv_contact_sent, pv_partner_sent, pv_withdrawal_sent): zeigt nach dem Absenden eines Formulars die Bestätigung an, Speicherdauer 10 Minuten.</li>
<li>Einwilligung: speichert Ihre Auswahl im Cookie-Banner, damit wir Sie nicht bei jedem Besuch erneut fragen, Speicherdauer [OFFEN: Name und Speicherdauer des Consent-Cookies eintragen, sobald das Banner gebaut ist].</li>
</ul>
<p>Alle weiteren Dienste, die Cookies setzen oder Informationen auf Ihrem Endgerät auslesen, insbesondere zu Statistik- und Marketingzwecken, laden wir erst, nachdem Sie im Cookie-Banner eingewilligt haben (§ 25 Abs. 1 TDDDG; Art. 6 Abs. 1 lit. a DSGVO). Im Banner können Sie alle Kategorien gleichwertig annehmen oder ablehnen oder einzeln auswählen. Ihre Einwilligung können Sie jederzeit mit Wirkung für die Zukunft über den Link „Cookie-Einstellungen“ im Fußbereich der Website ändern oder widerrufen. Zum Nachweis speichern wir Ihre Auswahl mit einer zufälligen Kennung, der Version des Banners, einem pseudonymisierten (gehashten) Wert Ihrer IP-Adresse und Angaben zu Ihrem Browser.</p>
<h3>Meta-Pixel und Conversions API</h3>
<p>Mit Ihrer Einwilligung in die Kategorie „Marketing“ nutzen wir das Meta-Pixel der Meta Platforms Ireland Ltd. (Irland), um zu messen, welche Werbeanzeigen auf Facebook und Instagram zu Besuchen und Käufen führen, und um Zielgruppen für Werbung zu bilden. Zusätzlich übermitteln wir Kaufereignisse serverseitig an Meta (Conversions API), dabei gegebenenfalls Ihre E-Mail-Adresse und Telefonnummer in gehashter (pseudonymisierter) Form. Für die Erhebung der Daten auf unserer Website und ihre Übermittlung an Meta sind wir gemeinsam mit Meta verantwortlich (Art. 26 DSGVO); die weitere Verarbeitung verantwortet Meta allein. Meta kann Daten in die USA übermitteln.</p>
<h3>Google Analytics 4 und Google Ads</h3>
<p>Mit Ihrer Einwilligung in die Kategorie „Statistik“ nutzen wir Google Analytics 4 der Google Ireland Limited (Irland), um die Nutzung unserer Website auszuwerten. Mit Ihrer Einwilligung in die Kategorie „Marketing“ nutzen wir das Conversion-Tracking von Google Ads einschließlich erweiterter Conversions, bei denen Ihre E-Mail-Adresse in gehashter (pseudonymisierter) Form an Google übermittelt wird. Ohne Ihre Einwilligung laden wir die Google-Dienste nicht. Google kann Daten in die USA übermitteln.</p>
<h3>TikTok-Pixel und Events API</h3>
<p>Mit Ihrer Einwilligung in die Kategorie „Marketing“ nutzen wir das TikTok-Pixel der TikTok Technology Limited (Irland), um den Erfolg von Werbeanzeigen auf TikTok zu messen, und übermitteln Kaufereignisse zusätzlich serverseitig (Events API), gegebenenfalls mit Ihrer E-Mail-Adresse in gehashter (pseudonymisierter) Form. TikTok kann Daten in Länder außerhalb des Europäischen Wirtschaftsraums übermitteln.</p>
<h3>Kampagnenparameter</h3>
<p>Mit Ihrer Einwilligung in die Kategorie „Marketing“ speichern wir außerdem Kampagnenparameter und Klick-Kennungen (zum Beispiel utm-Parameter, gclid, fbclid, ttclid) zu Ihrer Bestellung, um auszuwerten, über welche Werbung Sie zu uns gekommen sind.</p>
<h2>Rechtsgrundlagen</h2>
<p>Wir verarbeiten personenbezogene Daten auf folgenden Rechtsgrundlagen der Datenschutz-Grundverordnung (DSGVO):</p>
<ul>
<li>Art. 6 Abs. 1 lit. b DSGVO (Vertrag und vorvertragliche Maßnahmen): Bestellung, Zahlung, Lieferung, Kundenkonto und Anfragen zu Bestellungen.</li>
<li>Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung): steuer- und handelsrechtliche Aufbewahrung und Bearbeitung von Widerrufen.</li>
<li>Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen): sicherer Betrieb der Website, Schutz vor Missbrauch und Betrug, Beantwortung allgemeiner Anfragen, Nachweis von Einwilligungen sowie Geltendmachung und Abwehr von Ansprüchen.</li>
<li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung): Newsletter sowie Statistik- und Marketingdienste.</li>
</ul>
<p>Für eine Bestellung benötigen wir die im Bestellformular als Pflichtfeld gekennzeichneten Angaben; ohne sie können wir den Vertrag nicht schließen. Soweit wir Daten auf Grundlage berechtigter Interessen verarbeiten, können Sie dieser Verarbeitung aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit widersprechen (Art. 21 DSGVO).</p>
<h2>Websites und Links von Drittanbietern</h2>
<p>Die Services können Links zu Websites oder anderen Online-Plattformen bereitstellen, die von Drittanbietern betrieben werden. Wenn Sie Links zu Websites folgen, die keine Affiliate-Websites sind oder nicht von uns kontrolliert werden, sollten Sie deren Datenschutz- und Sicherheitsrichtlinien sowie sonstige Geschäftsbedingungen überprüfen. Wir übernehmen keine Garantie und sind nicht verantwortlich für den Datenschutz oder die Sicherheit solcher Websites, einschließlich der Genauigkeit, Vollständigkeit oder Zuverlässigkeit der auf diesen Websites befindlichen Informationen. Informationen, die Sie an öffentlichen oder halböffentlichen Orten bereitstellen, einschließlich der Informationen, die Sie auf Social Networking-Plattformen von Drittanbietern weitergeben, können auch von anderen Nutzern der Services und/oder Nutzern dieser Drittanbieter-Plattformen eingesehen werden, ohne Einschränkungen in Bezug auf deren Nutzung durch uns oder durch einen Drittanbieter. Die Aufnahme solcher Links durch uns bedeutet nicht, dass wir die Inhalte dieser Plattformen oder deren Eigentümer oder Betreiber unterstützen, es sei denn, dies ist in den Services ausdrücklich erwähnt.</p>
<h2>Daten von Kindern</h2>
<p>Die Services sind nicht für die Nutzung durch Kinder gedacht, und wir erfassen wissentlich keine personenbezogenen Daten von Kindern, die in Ihrem Land noch nicht volljährig sind. Wenn Sie die Eltern oder der Vormund eines Kindes sind, das uns seine personenbezogenen Daten zur Verfügung gestellt hat, können Sie sich über die unten angegebenen Kontaktdaten mit uns in Verbindung setzen, um die Löschung dieser Daten zu verlangen. Zum Zeitpunkt des Inkrafttretens dieser Datenschutzerklärung haben wir keine Kenntnis davon, dass wir personenbezogene Daten von Personen unter 16 Jahren „weitergeben“ oder „verkaufen“ (gemäß der Definition dieser Begriffe im geltenden Recht).</p>
<h2>Sicherheit und Aufbewahrung Ihrer Daten</h2>
<p>Bitte beachten Sie, dass keine Sicherheitsmaßnahmen perfekt oder undurchdringlich sind, und wir daher keine „perfekte Sicherheit“ garantieren können. Zudem können auch Informationen, die Sie uns senden, während der Übertragung Risiken ausgesetzt sein. Wir empfehlen Ihnen, bei der Übermittlung sensibler oder vertraulicher Informationen an uns keine unsicheren Kanäle zu verwenden.</p>
<p>Wie lange wir Ihre personenbezogenen Daten aufbewahren, hängt von verschiedenen Faktoren ab. Dazu gehören beispielsweise die Frage, ob wir die Daten benötigen, um Ihr Konto zu verwalten, Ihnen Services zur Verfügung zu stellen, rechtlichen Verpflichtungen nachzukommen, Streitigkeiten beizulegen oder andere geltende Verträge und Richtlinien durchzusetzen.</p>
<p>Insbesondere gilt: Bestell- und Rechnungsdaten bewahren wir für die Dauer der gesetzlichen Aufbewahrungsfristen auf (insbesondere § 147 AO und § 257 HGB, derzeit bis zu zehn Jahre). Daten Ihres Kundenkontos speichern wir, bis Sie das Konto löschen. Newsletter-Daten speichern wir bis zu Ihrer Abmeldung, den Nachweis Ihrer Einwilligung darüber hinaus, solange Ansprüche im Zusammenhang mit der Einwilligung geltend gemacht werden können.</p>
<h2>Ihre Rechte und Möglichkeiten</h2>
<p>Je nachdem, wo sich Ihr Wohnsitz befindet, haben Sie möglicherweise einige oder alle der unten aufgeführten Rechte in Bezug auf Ihre personenbezogenen Daten. Diese Rechte sind jedoch nicht absolut, gelten möglicherweise nur unter bestimmten Umständen, und in bestimmten Fällen können wir Ihre Anfrage im gesetzlich zulässigen Rahmen ablehnen.</p>
<ul>
<li><strong>Recht auf Zugang/Auskunft.</strong> Sie haben möglicherweise das Recht, Einsicht in die personenbezogenen Daten zu verlangen, die wir über Sie gespeichert haben.</li>
<li><strong>Recht auf Löschung.</strong> Sie haben möglicherweise das Recht, von uns die Löschung der über Sie gespeicherten personenbezogenen Daten zu verlangen.</li>
<li><strong>Recht auf Berichtigung.</strong> Sie haben möglicherweise das Recht, von uns die Berichtigung fehlerhafter personenbezogener Daten zu verlangen, die wir über Sie gespeichert haben.</li>
<li><strong>Recht auf Datenübertragbarkeit.</strong> Sie haben möglicherweise das Recht, eine Kopie der personenbezogenen Daten, die wir über Sie gespeichert haben, zu erhalten und zu verlangen, dass wir sie unter bestimmten Umständen und mit bestimmten Ausnahmen an einen Dritten weitergeben.</li>
<li><strong>Verwaltung von Kommunikationseinstellungen.</strong> Wir können Ihnen Werbe-E-Mails zusenden. Sie können dem Erhalt dieser E-Mails jederzeit widersprechen, indem Sie die Option zum Abbestellen nutzen, die in unseren E-Mails an Sie enthalten ist. Wenn Sie sich dagegen entscheiden, können wir Ihnen weiterhin nicht werbliche E-Mails schicken, z. B. über Ihr Konto oder über Bestellungen, die Sie getätigt haben.</li>
</ul>
<p>Wenn sich Ihr Wohnsitz im Vereinigten Königreich oder im Europäischen Wirtschaftsraum befindet, können Sie vorbehaltlich der Ausnahmen und Beschränkungen durch das lokale Recht zusätzlich zu den oben genannten Rechten die folgenden Rechte ausüben:</p>
<ul>
<li><strong>Recht auf Widerspruch und Recht auf Einschränkung der Verarbeitung.</strong> Sie haben möglicherweise das Recht, von uns zu verlangen, dass wir die Verarbeitung personenbezogener Daten für bestimmte Zwecke einstellen oder einschränken.</li>
<li><strong>Widerruf der Einwilligung.</strong> Sofern wir uns auf eine Einwilligung zur Verarbeitung Ihrer personenbezogenen Daten stützen, haben Sie das Recht, diese Einwilligung zu widerrufen. Wenn Sie Ihre Einwilligung widerrufen, hat dies keinen Einfluss auf die Rechtmäßigkeit der Verarbeitung, die auf Ihrer Einwilligung vor dem Widerruf beruht.</li>
</ul>
<p>Sie können diese Rechte ausüben, wenn dies in den Services entsprechend angegeben ist, oder indem Sie sich über die unten angegebenen Kontaktdaten mit uns in Verbindung setzen.</p>
<p>Durch die Ausübung dieser Rechte entstehen Ihnen keinerlei Nachteile. Sofern dies nach geltendem Recht zulässig oder erforderlich ist, müssen wir möglicherweise Ihre Identität überprüfen, bevor wir Ihre Anfragen verarbeiten können. In Übereinstimmung mit geltenden Gesetzen können Sie einen Bevollmächtigten benennen, der in Ihrem Namen Anfragen zur Ausübung Ihrer Rechte stellt. Bevor wir eine solche Anfrage von einem Vertreter annehmen, verlangen wir von diesem den Nachweis, dass Sie ihn bevollmächtigt haben, in Ihrem Namen zu handeln. Dabei kann es erforderlich sein, dass Sie Ihre Identität direkt uns gegenüber bestätigen müssen. Wir werden Ihre Anfrage im Rahmen des geltenden Rechts zügig beantworten.</p>
<h2>Beschwerden</h2>
<p>Wenn Sie Beschwerden darüber haben, wie wir Ihre personenbezogenen Daten verarbeiten, wenden Sie sich bitte über die unten angegebenen Kontaktdaten an uns. Je nachdem, wo sich Ihr Wohnsitz befindet, haben Sie das Recht, gegen unsere Entscheidung Einspruch zu erheben, indem Sie sich unter den unten angegebenen Kontaktdaten an uns wenden oder Ihre Beschwerde bei der zuständigen Datenschutzbehörde einreichen. Für den Europäischen Wirtschaftsraum gibt es eine Liste der zuständigen Datenschutzaufsichtsbehörden. Wenn Sie sie abrufen möchten, <a href="https://edpb.europa.eu/about-edpb/about-edpb/members">haben Sie hier die Möglichkeit dazu</a>. Für uns zuständig ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), <a href="https://www.lda.bayern.de">www.lda.bayern.de</a>.</p>
<h2>Internationale Übertragungen</h2>
<p>Beachten Sie, dass wir Ihre personenbezogenen Daten möglicherweise außerhalb des Landes, in dem sich Ihr Wohnsitz befindet, übertragen, speichern und verarbeiten. Das betrifft insbesondere die im Abschnitt „Dienstleister und Empfänger“ und im Abschnitt „Cookies, Einwilligung und Tracking“ genannten Anbieter mit Sitz oder Konzernverbindungen außerhalb des Europäischen Wirtschaftsraums.</p>
<p>Wenn wir Ihre personenbezogenen Daten außerhalb des Europäischen Wirtschaftsraums oder des Vereinigten Königreichs übermitteln, stützen wir uns auf anerkannte Übermittlungsmechanismen wie die Standardvertragsklauseln der Europäischen Kommission oder gleichwertige Verträge, die von der jeweils zuständigen Behörde des Vereinigten Königreichs herausgegeben werden, es sei denn, die Datenübermittlung erfolgt in ein Land, das nachweislich ein angemessenes Schutzniveau bietet. Für Übermittlungen in die USA an Unternehmen, die nach dem EU-US Data Privacy Framework zertifiziert sind, besteht ein solcher Angemessenheitsbeschluss der Europäischen Kommission.</p>
<h2>Änderungen an dieser Datenschutzerklärung</h2>
<p>Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren, um beispielsweise Änderungen unserer Verfahrensweisen zu berücksichtigen, oder aus anderen betrieblichen, rechtlichen oder regulatorischen Gründen. Wir veröffentlichen die überarbeitete Datenschutzerklärung auf dieser Website, passen den angegebenen Stand entsprechend an und machen die nach geltendem Recht erforderliche Mitteilung.</p>
<h2>Kontakt</h2>
<p>Sollten Sie Fragen zu unseren Datenschutzverfahren oder dieser Datenschutzerklärung haben, oder wenn Sie eines der Ihnen zustehenden Rechte ausüben möchten, wenden Sie sich bitte telefonisch unter +491629231702, per E-Mail unter hello@provibe-drinks.de oder per Post an CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland an uns. Im Sinne der geltenden Datenschutzgesetze sind wir der Verantwortliche für Ihre personenbezogenen Daten.</p>$html$,
'Entwurf Version 2 (17.10.2026): Shopify-Passagen ersetzt durch Netlify, Supabase (Frankfurt), Stripe mit PayPal und Klarna, Resend, Lexware Office, DHL; neue Abschnitte Kundenkonto, Newsletter (Double Opt-in), Kontaktformulare, Cookies und Tracking (Meta, Google, TikTok nur mit Einwilligung), Rechtsgrundlagen, Aufsichtsbehörde (DS-1 bis DS-22). Enthält einen [OFFEN]-Marker (Consent-Cookie). Gegenüberstellung: docs/rechtstexte-aenderungen.md. Nicht veröffentlicht, Freigabe durch Auftraggeber und Anwalt ausstehend.',
'draft', null
from public.legal_documents d where d.kind = 'datenschutz'
on conflict do nothing;

-- Prüfung: jedes der fünf Dokumente hat jetzt eine Version 2 (Entwurf oder später freigegeben).
do $$
declare v_bad integer;
begin
  select count(*) into v_bad
  from public.legal_documents d
  where not exists (select 1 from public.legal_document_versions v
                    where v.document_id = d.id and v.version = 2 and v.locale = 'de');
  if v_bad > 0 then
    raise exception 'Rechtstexte v2: % Dokument(e) ohne Version 2', v_bad;
  end if;
end $$;
