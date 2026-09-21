-- Seed aus dem Shopify-Snapshot vom 21.09.2026. Generiert von scripts/seed/generate-seed-sql.ts, nicht von Hand ändern.
-- Idempotent (feste UUIDs, ON CONFLICT). Bilder zeigen auf Pfade im Bucket product-media unter seed/...
begin;

-- @@
insert into public.tax_rates (id, country_code, tax_class, rate_bp, name) values
  ('f16d3f9a-fe73-5b91-a7cc-0b0c6216ce33', 'DE', 'standard', 1900, 'Deutschland 19 %'),
  ('9716ee1c-004e-5296-a48a-941c3750c440', 'DE', 'reduced', 700, 'Deutschland 7 %'),
  ('6fe4d9d5-77f0-5a7f-ae68-03efe2372c0c', 'AT', 'standard', 2000, 'Österreich 20 %'),
  ('11d1f221-927b-5804-ac7f-3942ddacca6f', 'AT', 'reduced', 1000, 'Österreich 10 %')
on conflict (country_code, tax_class, valid_from) do update set rate_bp = excluded.rate_bp, name = excluded.name;
-- @@
insert into public.shipping_zones (id, code, name, country_codes, is_enabled, position) values
  ('75d8774f-1239-5e83-ad3d-484803f9dcc8', 'de', 'Deutschland', array['DE']::char(2)[], true, 0),
  ('df3a6d27-6887-52eb-a489-4f998b35b037', 'at', 'Österreich', array['AT']::char(2)[], false, 1)
on conflict (code) do update set name = excluded.name, country_codes = excluded.country_codes;
-- @@
insert into public.shipping_rates (id, zone_id, name, description, price_cents, free_above_subtotal_cents, delivery_time_text, position) values
  ('54b1d33a-425a-5489-acd9-4a9300d1e844', '75d8774f-1239-5e83-ad3d-484803f9dcc8', 'DHL Paket', 'Versand innerhalb Deutschlands', 490, 5000, '3–5 Werktage', 0),
  ('7f1e3ab0-5a0d-5e53-ad14-c523bd37954e', 'df3a6d27-6887-52eb-a489-4f998b35b037', 'DHL Paket International', 'Versand nach Österreich (vorbereitet, abgeschaltet)', 990, 8000, '4–7 Werktage', 0)
on conflict (id) do update set price_cents = excluded.price_cents, free_above_subtotal_cents = excluded.free_above_subtotal_cents, delivery_time_text = excluded.delivery_time_text;
-- @@
insert into public.shop_settings (key, value, is_public) values
  ('shop.name', '"provibe"'::jsonb, true),
  ('shop.tagline', '"Eistee mit Protein"'::jsonb, true),
  ('shop.legal_entity', '{"name":"CG Projects UG (haftungsbeschränkt)","street":"Kurt-Viermetz-Straße 1a","zip":"86150","city":"Augsburg","country":"DE","managing_director":"Celine Grimm","vat_id":"DE457662597","register":"Amtsgericht Augsburg, HRB 41818","phone":"+491629231702","email":"hello@provibe-drinks.de","lucid_number":""}'::jsonb, true),
  ('shop.contact', '{"email":"hello@provibe-drinks.de","support_email":"support@provibe-drinks.de","partner_email":"partner@provibe-drinks.de","phone":"+491629231702"}'::jsonb, true),
  ('shop.social', '{"instagram":"https://www.instagram.com/provibe.de","tiktok":"https://www.tiktok.com/@provibe.de"}'::jsonb, true),
  ('shop.default_delivery_time', '"3–5 Werktage"'::jsonb, true),
  ('shop.deposit_default_cents', '25'::jsonb, true),
  ('checkout.button_label', '"Zahlungspflichtig bestellen"'::jsonb, true),
  ('seo.default_title_suffix', '" | provibe"'::jsonb, true),
  ('seo.default_description', '"provibe ist erfrischender Eistee mit 15 g Protein, ohne Zucker, ready to drink. Wildberry, Raspberry Lime und Peach."'::jsonb, true),
  ('tracking', '{"meta_pixel_id":"","ga4_measurement_id":"","google_ads_conversion_id":"","google_ads_labels":{},"tiktok_pixel_id":""}'::jsonb, true),
  ('consent.banner_version', '"2026-09-21"'::jsonb, true),
  ('email.allowlist_active', 'true'::jsonb, false)
on conflict (key) do nothing;
-- @@
insert into public.announcement_messages (id, message, position) values
  ('21dffa88-130b-587f-a56a-fd6139f54d12', 'Versandkostenfrei ab 50 €', 0),
  ('d0e0cb8a-ffc6-50dd-a3ba-4f8456d6dc74', '10% Rabatt auf deine Bestellung mit dem Code PRESALE10', 1)
on conflict (id) do update set message = excluded.message;
-- @@
insert into public.menus (id, handle, name) values ('62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 'main', 'Hauptnavigation') on conflict (handle) do nothing;
-- @@
insert into public.menu_items (id, menu_id, position, label, url) values
  ('822184d0-c40f-562f-aa8c-7fdb1dcbacc3', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 0, '{"de":"Shop"}'::jsonb, '/pages/shop'),
  ('003edace-ceeb-54ec-a9ca-96e7c1d994a2', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 1, '{"de":"Über uns"}'::jsonb, '/pages/uber-uns'),
  ('b21e8267-4744-506c-a178-d7147c53ba4b', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 2, '{"de":"Partner"}'::jsonb, '/pages/partner'),
  ('dc5b1d10-e22e-54ac-a71e-57aea56e81a3', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 3, '{"de":"Kontakt"}'::jsonb, '/pages/contact')
on conflict (id) do update set label = excluded.label, url = excluded.url, position = excluded.position;
-- @@
insert into public.menus (id, handle, name) values ('169e0dca-49ff-594b-a07e-e99c6f74905d', 'footer-quick', 'Footer Quick-Links') on conflict (handle) do nothing;
-- @@
insert into public.menu_items (id, menu_id, position, label, url) values
  ('b3b073de-af9e-59e0-a7dc-beb0824aed79', '169e0dca-49ff-594b-a07e-e99c6f74905d', 0, '{"de":"Impressum"}'::jsonb, '/pages/impressum'),
  ('c6befc7c-c80f-5b25-a747-10215713739a', '169e0dca-49ff-594b-a07e-e99c6f74905d', 1, '{"de":"Datenschutzerklärung"}'::jsonb, '/policies/privacy-policy'),
  ('7dfccc29-2d40-5626-a80d-4750a2f394fb', '169e0dca-49ff-594b-a07e-e99c6f74905d', 2, '{"de":"AGB"}'::jsonb, '/pages/allgemeine-geschaftsbedingungen'),
  ('908de3e2-456d-5a8f-a15e-f65725bc6718', '169e0dca-49ff-594b-a07e-e99c6f74905d', 3, '{"de":"Widerruf"}'::jsonb, '/pages/ruckgabe-und-wiederrufsbelehrung'),
  ('951e67d6-9c1e-55f4-a3f5-aa186b26d3c9', '169e0dca-49ff-594b-a07e-e99c6f74905d', 4, '{"de":"Versand"}'::jsonb, '/pages/versand'),
  ('4571b045-fd7a-5547-ab19-376b6d19cbeb', '169e0dca-49ff-594b-a07e-e99c6f74905d', 5, '{"de":"Vertrag widerrufen"}'::jsonb, '/pages/widerruf-formular')
on conflict (id) do update set label = excluded.label, url = excluded.url, position = excluded.position;
-- @@
insert into public.discount_codes (id, code, title, kind, value, is_active) values
  ('caddaa38-8c28-5f32-ab7f-001b7bee795c', 'PRESALE10', '10 % Pre-Sale-Rabatt', 'percentage', 1000, true)
on conflict (code) do nothing;
-- @@
insert into public.automations (key, name, is_enabled, config) values
  ('welcome', 'Willkommensmail nach Opt-in', false, '{"delay_minutes":5}'),
  ('abandoned_cart', 'Warenkorbabbrecher-Mail', false, '{"delay_hours":24,"requires_marketing_consent":true}'),
  ('review_request', 'Bewertungsanfrage nach Zustellung', false, '{"delay_days":7}')
on conflict (key) do nothing;
-- @@
insert into public.legal_documents (id, kind, path) values ('8e2cbc6b-b94a-57a9-a010-9524764d484e', 'impressum', '/pages/impressum') on conflict (kind) do nothing;
-- @@
insert into public.legal_document_versions (id, document_id, version, title, body_html, change_note, status, effective_from)
  values ('e7701730-f385-53dc-a3b1-04400e26571f', '8e2cbc6b-b94a-57a9-a010-9524764d484e', 1, 'Impressum', '<p>Impressum</p>
<p>Impressum</p>
<p>Gesetzliche Anbieterkennung:</p>
<p>CG Projects UG (haftungsbeschränkt)</p>
<p>Kurt-Viermetz-Straße 1a</p>
<p>86150 Augsburg</p>
<p>Deutschland</p>
<p>vertr. d. d. Geschäftsführer Celine Grimm</p>
<p>Telefon: +491629231702</p>
<p>E-Mail: hello@provibe-drinks.de</p>
<p>Email Marketing</p>
<p>USt-IdNr.: DE457662597</p>
<p>eingetragen im Handelsregister des Amtsgerichtes Augsburg</p>
<p>Handelsregisternummer HRB 41818</p>
<p>zuständige Aufsichtsbehörde für audiovisuelle Mediendienste:</p>
<p>Bayerische Landeszentrale für neue Medien (BLM)</p>
<p>Heinrich-Lübke-Str. 27</p>
<p>81737 München</p>
<p>Internet: <a href="https://www.blm.de/de/startseite.cfm">https://www.blm.de/</a></p>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor Verbraucherschlichtungsstellen teilzunehmen.</p>', 'Übernahme aus dem Shopify-Shop (Stand 21.09.2026), noch ohne Ersetzung der Shopify-Nennungen', 'draft', null)
on conflict (document_id, locale, version) do nothing;
-- @@
insert into public.legal_documents (id, kind, path) values ('f150d258-c115-500d-afdf-bf8a0185d360', 'agb', '/pages/allgemeine-geschaftsbedingungen') on conflict (kind) do nothing;
-- @@
insert into public.legal_document_versions (id, document_id, version, title, body_html, change_note, status, effective_from)
  values ('bff39a69-ade3-5178-a505-e7e9041a8691', 'f150d258-c115-500d-afdf-bf8a0185d360', 1, 'Allgemeine Geschäftsbedingungen', '<p>Allgemeine Geschäftsbedingungen</p>
<p>Allgemeine Geschäftsbedingungen und Kundeninformationen</p>
<p>I. Allgemeine Geschäftsbedingungen</p>
<p>§ 1 Grundlegende Bestimmungen</p>
<p>(1) Die nachstehenden Geschäftsbedingungen gelten für Verträge, die Sie mit uns als Anbieter (CG Projects UG (haftungsbeschränkt)) über die Internetseite www.provibe-drinks.de/ schließen. Soweit nicht anders vereinbart, wird der Einbeziehung gegebenenfalls von Ihnen verwendeter eigener Bedingungen widersprochen.</p>
<p>(2) Verbraucher im Sinne der nachstehenden Regelungen ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden kann. Unternehmer ist jede natürliche oder juristische Person oder eine rechtsfähige Personengesellschaft, die bei Abschluss eines Rechtsgeschäfts in Ausübung ihrer selbständigen beruflichen oder gewerblichen Tätigkeit handelt.</p>
<p>§ 2 Zustandekommen des Vertrages</p>
<p>(1) Gegenstand des Vertrages ist der Verkauf von Waren .</p>
<p>(2) Bereits mit dem Einstellen des jeweiligen Produkts auf unserer Internetseite unterbreiten wir Ihnen ein verbindliches Angebot zum Abschluss eines Vertrages über das Online-Warenkorbsystem zu den in der Artikelbeschreibung angegebenen Bedingungen.</p>
<p>(3) Der Vertrag kommt über das Online-Warenkorbsystem wie folgt zustande:</p>
<p>Die zum Kauf beabsichtigten Waren werden im "Warenkorb" abgelegt. Über die entsprechende Schaltfläche in der Navigationsleiste können Sie den "Warenkorb" aufrufen und dort jederzeit Änderungen vornehmen.</p>
<p>Nach Anklicken der Schaltfläche "Kasse" oder "Weiter zur Bestellung" (oder ähnliche Bezeichnung) und der Eingabe der persönlichen Daten sowie der Zahlungs- und Versandbedingungen werden Ihnen abschließend die Bestelldaten als Bestellübersicht angezeigt.</p>
<p>Soweit Sie als Zahlungsart ein Sofortzahl-System (z.B. PayPal (Express/Plus/Checkout), Amazon Pay, Sofort) nutzen, werden Sie entweder auf die Bestellübersichtsseite in unserem Online-Shop geführt oder auf die Internetseite des Anbieters des Sofortzahl-Systems weitergeleitet.</p>
<p>Erfolgt eine Weiterleitung zu dem jeweiligen Sofortzahl-System, nehmen Sie dort die entsprechende Auswahl bzw. Eingabe Ihrer Daten vor. Abschließend werden Ihnen auf der Internetseite des Anbieters des Sofortzahl-Systems oder nachdem Sie zurück in unseren Online-Shop geleitet wurden, die Bestelldaten als Bestellübersicht angezeigt.</p>
<p>Vor Absenden der Bestellung haben Sie die Möglichkeit, die Angaben in der Bestellübersicht nochmals zu überprüfen, zu ändern (auch über die Funktion "zurück" des Internetbrowsers) bzw. die Bestellung abzubrechen.</p>
<p>Mit dem Absenden der Bestellung über die entsprechende Schaltfläche ("zahlungspflichtig bestellen", "kaufen" / "jetzt kaufen", "kostenpflichtig bestellen", "bezahlen" / "jetzt bezahlen" oder ähnliche Bezeichnung) erklären Sie rechtsverbindlich die Annahme des Angebotes, wodurch der Vertrag zustande kommt.</p>
<p>(4) Die Abwicklung der Bestellung und Übermittlung aller im Zusammenhang mit dem Vertragsschluss erforderlichen Informationen erfolgt per E-Mail zum Teil automatisiert. Sie haben deshalb sicherzustellen, dass die von Ihnen bei uns hinterlegte E-Mail-Adresse zutreffend ist, der Empfang der E-Mails technisch sichergestellt und insbesondere nicht durch SPAM-Filter verhindert wird.</p>
<p>§ 3 Vertragslaufzeit / Kündigung bei Abonnement-Verträgen</p>
<p>(1) Der zwischen Ihnen und uns geschlossene Abonnement-Vertrag hat eine unbestimmte Laufzeit. Der Vertrag kann von beiden Parteien mit einer Frist von einem Monat zum Monatsende (soweit im jeweiligen Angebot nichts anderes geregelt ist) gekündigt werden.</p>
<p>(2) Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt hiervon unberührt.</p>
<p>(3) Jede Kündigung muss entweder in Textform (z.B. E-Mail) oder über die auf unserer Internetpräsenz eingebundene Kündigungsschaltfläche (“Verträge hier kündigen” oder ähnliche Bezeichnung) erklärt und übermittelt werden.</p>
<p>§ 4 Zurückbehaltungsrecht, Eigentumsvorbehalt</p>
<p>(1) Ein Zurückbehaltungsrecht können Sie nur ausüben, soweit es sich um Forderungen aus demselben Vertragsverhältnis handelt.</p>
<p>(2) Die Ware bleibt bis zur vollständigen Zahlung des Kaufpreises unser Eigentum.</p>
<p>(3) Sind Sie Unternehmer, gilt ergänzend Folgendes:</p>
<p>a) Wir behalten uns das Eigentum an der Ware bis zum vollständigen Ausgleich aller Forderungen aus der laufenden Geschäftsbeziehung vor. Vor Übergang des Eigentums an der Vorbehaltsware ist eine Verpfändung oder Sicherheitsübereignung nicht zulässig.</p>
<p>b) Sie können die Ware im ordentlichen Geschäftsgang weiterverkaufen. Für diesen Fall treten Sie bereits jetzt alle Forderungen in Höhe des Rechnungsbetrages, die Ihnen aus dem Weiterverkauf erwachsen, an uns ab, wir nehmen die Abtretung an. Sie sind weiter zur Einziehung der Forderung ermächtigt. Soweit Sie Ihren Zahlungsverpflichtungen nicht ordnungsgemäß nachkommen, behalten wir uns allerdings vor, die Forderung selbst einzuziehen.</p>
<p>c) Bei Verbindung und Vermischung der Vorbehaltsware erwerben wir Miteigentum an der neuen Sache im Verhältnis des Rechnungswertes der Vorbehaltsware zu den anderen verarbeiteten Gegenständen zum Zeitpunkt der Verarbeitung.</p>
<p>d) Wir verpflichten uns, die uns zustehenden Sicherheiten auf Ihr Verlangen insoweit freizugeben, als der realisierbare Wert unserer Sicherheiten die zu sichernde Forderung um mehr als 10% übersteigt. Die Auswahl der freizugebenden Sicherheiten obliegt uns.</p>
<p>§ 5 Gewährleistung</p>
<p>(1) Es bestehen die gesetzlichen Mängelhaftungsrechte.</p>
<p>(2) Als Verbraucher werden Sie gebeten, die Ware bei Lieferung umgehend auf Vollständigkeit, offensichtliche Mängel und Transportschäden zu überprüfen und uns sowie dem Spediteur Beanstandungen schnellstmöglich mitzuteilen. Kommen Sie dem nicht nach, hat dies keine Auswirkung auf Ihre gesetzlichen Gewährleistungsansprüche.</p>
<p>(3) Soweit ein Merkmal der Ware von den objektiven Anforderungen abweicht, gilt die Abweichung nur dann als vereinbart, wenn Sie vor Abgabe der Vertragserklärung durch uns über selbige in Kenntnis gesetzt wurden und die Abweichung ausdrücklich und gesondert zwischen den Vertragsparteien vereinbart wurde.</p>
<p>(4) Soweit Sie Unternehmer sind, gilt abweichend von den vorstehenden Gewährleistungsregelungen:</p>
<p>a) Als Beschaffenheit der Ware gelten nur unsere eigenen Angaben und die Produktbeschreibung des Herstellers als vereinbart, nicht jedoch sonstige Werbung, öffentliche Anpreisungen und Äußerungen des Herstellers.</p>
<p>b) Bei Mängeln leisten wir nach unserer Wahl Gewähr durch Nachbesserung oder Nachlieferung. Schlägt die Mangelbeseitigung fehl, können Sie nach Ihrer Wahl Minderung verlangen oder vom Vertrag zurücktreten. Die Mängelbeseitigung gilt nach erfolglosem zweiten Versuch als fehlgeschlagen, wenn sich nicht insbesondere aus der Art der Ware oder des Mangels oder den sonstigen Umständen etwas anderes ergibt. Im Falle der Nachbesserung müssen wir nicht die erhöhten Kosten tragen, die durch die Verbringung der Ware an einen anderen Ort als den Erfüllungsort entstehen, sofern die Verbringung nicht dem bestimmungsgemäßen Gebrauch der Ware entspricht.</p>
<p>c) Die Gewährleistungsfrist beträgt ein Jahr ab Ablieferung der Ware. Die Fristverkürzung gilt nicht:</p>
<ul><li>für uns zurechenbare schuldhaft verursachte Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit und bei vorsätzlich oder grob fahrlässig verursachten sonstigen Schäden;</li></ul>
<ul><li>soweit wir den Mangel arglistig verschwiegen oder eine Garantie für die Beschaffenheit der Sache übernommen haben;</li></ul>
<ul><li>bei Sachen, die entsprechend ihrer üblichen Verwendungsweise für ein Bauwerk verwendet worden sind und dessen Mangelhaftigkeit verursacht haben;</li></ul>
<ul><li>bei gesetzlichen Rückgriffsansprüchen, die Sie im Zusammenhang mit Mängelrechten gegen uns haben.</li></ul>
<p>§ 6 Rechtswahl, Erfüllungsort, Gerichtsstand</p>
<p>(1) Es gilt deutsches Recht. Bei Verbrauchern gilt diese Rechtswahl nur, soweit hierdurch der durch zwingende Bestimmungen des Rechts des Staates des gewöhnlichen Aufenthaltes des Verbrauchers gewährte Schutz nicht entzogen wird (Günstigkeitsprinzip).</p>
<p>(2) Erfüllungsort für alle Leistungen aus den mit uns bestehenden Geschäftsbeziehungen sowie Gerichtsstand ist unser Sitz, soweit Sie nicht Verbraucher, sondern Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen sind. Dasselbe gilt, wenn Sie keinen allgemeinen Gerichtsstand in Deutschland oder der EU haben oder der Wohnsitz oder gewöhnliche Aufenthalt im Zeitpunkt der Klageerhebung nicht bekannt ist. Die Befugnis, auch das Gericht an einem anderen gesetzlichen Gerichtsstand anzurufen, bleibt hiervon unberührt.</p>
<p>(3) Die Bestimmungen des UN-Kaufrechts finden ausdrücklich keine Anwendung.</p>
<p>II. Kundeninformationen</p>
<p>1. Identität des Verkäufers</p>
<p>CG Projects UG (haftungsbeschränkt)</p>
<p>Kurt-Viermetz-Straße 1a</p>
<p>86150 Augsburg</p>
<p>Deutschland</p>
<p>Telefon: +491629231702</p>
<p>E-Mail: hello@provibe-drinks.de</p>
<p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor Verbraucherschlichtungsstellen teilzunehmen.</p>
<p>2. Informationen zum Zustandekommen des Vertrages</p>
<p>Die technischen Schritte zum Vertragsschluss, der Vertragsschluss selbst und die Korrekturmöglichkeiten erfolgen nach Maßgabe der Regelungen "Zustandekommen des Vertrages" unserer Allgemeinen Geschäftsbedingungen (Teil I.).</p>
<p>3. Vertragssprache, Vertragstextspeicherung</p>
<p>3.1. Vertragssprache ist deutsch .</p>
<p>3.2. Der vollständige Vertragstext wird von uns nicht gespeichert. Vor Absenden der Bestellung über das Online - Warenkorbsystem können die Vertragsdaten über die Druckfunktion des Browsers ausgedruckt oder elektronisch gesichert werden. Nach Zugang der Bestellung bei uns werden die Bestelldaten, die gesetzlich vorgeschriebenen Informationen bei Fernabsatzverträgen und die Allgemeinen Geschäftsbedingungen nochmals per E-Mail an Sie übersandt.</p>
<p>4. Wesentliche Merkmale der Ware oder Dienstleistung</p>
<p>Die wesentlichen Merkmale der Ware und/oder Dienstleistung finden sich im jeweiligen Angebot.</p>
<p>5. Preise und Zahlungsmodalitäten</p>
<p>5.1. Die in den jeweiligen Angeboten angeführten Preise sowie die Versandkosten stellen Gesamtpreise dar. Sie beinhalten alle Preisbestandteile einschließlich aller anfallenden Steuern.</p>
<p>5.2. Die anfallenden Versandkosten sind nicht im Kaufpreis enthalten. Sie sind über eine entsprechend bezeichnete Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot aufrufbar, werden im Laufe des Bestellvorganges gesondert ausgewiesen und sind von Ihnen zusätzlich zu tragen, soweit nicht die versandkostenfreie Lieferung zugesagt ist.</p>
<p>5.3. Die Ihnen zur Verfügung stehenden Zahlungsarten sind unter einer entsprechend bezeichneten Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot ausgewiesen.</p>
<p>5.4. Soweit bei den einzelnen Zahlungsarten nicht anders angegeben, sind die Zahlungsansprüche aus dem geschlossenen Vertrag sofort zur Zahlung fällig.</p>
<p>6. Lieferbedingungen</p>
<p>6.1. Die Lieferbedingungen, der Liefertermin sowie gegebenenfalls bestehende Lieferbeschränkungen finden sich unter einer entsprechend bezeichneten Schaltfläche auf unserer Internetpräsenz oder im jeweiligen Angebot.</p>
<p>6.2. Soweit Sie Verbraucher sind, ist gesetzlich geregelt, dass die Gefahr des zufälligen Untergangs und der zufälligen Verschlechterung der verkauften Sache während der Versendung erst mit der Übergabe der Ware an Sie übergeht, unabhängig davon, ob die Versendung versichert oder unversichert erfolgt. Dies gilt nicht, wenn Sie eigenständig ein nicht vom Unternehmer benanntes Transportunternehmen oder eine sonst zur Ausführung der Versendung bestimmte Person beauftragt haben.</p>
<p>Sind Sie Unternehmer, erfolgt die Lieferung und Versendung auf Ihre Gefahr.</p>
<p>7. Gesetzliches Mängelhaftungsrecht</p>
<p>Die Mängelhaftung richtet sich nach der Regelung "Gewährleistung" in unseren Allgemeinen Geschäftsbedingungen (Teil I).</p>
<p>8. Vertragslaufzeit / Kündigung</p>
<p>Informationen zur Laufzeit des Vertrages sowie den Kündigungsbedingungen finden Sie in der Regelung "Vertragslaufzeit / Kündigung bei Abonnement-Verträgen" in unseren Allgemeinen Geschäftsbedingungen (Teil I) sowie im jeweiligen Angebot.</p>
<p>Diese AGB und Kundeninformationen wurden von den auf IT-Recht spezialisierten Juristen des Händlerbundes erstellt und werden permanent auf Rechtskonformität geprüft. Die Händlerbund Management AG garantiert für die Rechtssicherheit der Texte und haftet im Falle von Abmahnungen. Nähere Informationen dazu finden Sie unter: <a href="https://www.haendlerbund.de/de/leistungen/rechtssicherheit/agb-service">https://www.haendlerbund.de/de/leistungen/rechtssicherheit/agb-service</a>.</p>', 'Übernahme aus dem Shopify-Shop (Stand 21.09.2026), noch ohne Ersetzung der Shopify-Nennungen', 'draft', null)
on conflict (document_id, locale, version) do nothing;
-- @@
insert into public.legal_documents (id, kind, path) values ('465b5015-0da0-555e-aa9e-c9394bd880bf', 'widerruf', '/pages/ruckgabe-und-wiederrufsbelehrung') on conflict (kind) do nothing;
-- @@
insert into public.legal_document_versions (id, document_id, version, title, body_html, change_note, status, effective_from)
  values ('6c0a266d-8ada-58b0-a098-16338698babc', '465b5015-0da0-555e-aa9e-c9394bd880bf', 1, 'Rückgabe- und Widerrufsbelehrung', '<p>Rückgabe- und Widerrufsbelehrung</p>
<p>Widerrufsrecht für den Verkauf von Waren</p>
<p>Widerrufsrecht für Verbraucher</p>
<p>(Verbraucher ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbstständigen beruflichen Tätigkeit zugerechnet werden können.)</p>
<p>Widerrufsbelehrung</p>
<p>Widerrufsrecht</p>
<p>Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
<p>Die Widerrufsfrist beträgt 14 Tage ab dem Tag,</p>
<ul><li>an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat, sofern Sie eine oder mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese einheitlich geliefert wird bzw. werden;</li></ul>
<ul><li>an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die letzte Ware in Besitz genommen haben bzw. hat, sofern Sie mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese getrennt geliefert werden;</li></ul>
<ul><li>an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die erste Ware in Besitz genommen haben bzw. hat, sofern im Rahmen einer Bestellung Waren zur regelmäßigen Lieferung über einen festgelegten Zeitraum hinweg geliefert werden.</li></ul>
<p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Telefonnr.: +491629231702, E-Mail-Adresse: support@provibe-drinks.de) mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
<p>Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.</p>
<p>Folgen des Widerrufs</p>
<p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen 14 Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.</p>
<p>Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.</p>
<p>Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen 14 Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns oder an Bei St Ursula 16a, 86150 Augsburg zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von 14 Tagen absenden.</p>
<p>Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.</p>
<p>Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.</p>
<p>Ausschluss- bzw. Erlöschensgründe</p>
<p>Das Widerrufsrecht besteht nicht bei Verträgen</p>
<ul><li>zur Lieferung von Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind;</li></ul>
<ul><li>zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde;</li></ul>
<ul><li>zur Lieferung alkoholischer Getränke, deren Preis bei Vertragsschluss vereinbart wurde, die aber frühestens 30 Tage nach Vertragsschluss geliefert werden können und deren aktueller Wert von Schwankungen auf dem Markt abhängt, auf die der Unternehmer keinen Einfluss hat;</li></ul>
<ul><li>zur Lieferung von Zeitungen, Zeitschriften oder Illustrierten mit Ausnahme von Abonnement-Verträgen.</li></ul>
<p>Das Widerrufsrecht erlischt vorzeitig bei Verträgen</p>
<ul><li>zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde;</li></ul>
<ul><li>zur Lieferung von Waren, wenn diese nach der Lieferung aufgrund ihrer Beschaffenheit untrennbar mit anderen Gütern vermischt wurden;</li></ul>
<ul><li>zur Lieferung von Ton- oder Videoaufnahmen oder Computersoftware in einer versiegelten Packung, wenn die Versiegelung nach der Lieferung entfernt wurde.</li></ul>
<p>Muster-Widerrufsformular</p>
<p>(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
<ul><li>An CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, E-Mail-Adresse: support@provibe-drinks.de :</li></ul>
<ul><li>Hiermit widerrufe(n) ich/ wir (*) den von mir/ uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/</li></ul>
<p>die Erbringung der folgenden Dienstleistung (*)</p>
<ul><li>Bestellt am (*)/ erhalten am (*)</li></ul>
<ul><li>Name des/ der Verbraucher(s)</li></ul>
<ul><li>Anschrift des/ der Verbraucher(s)</li></ul>
<ul><li>Unterschrift des/ der Verbraucher(s) (nur bei Mitteilung auf Papier)</li></ul>
<ul><li>Datum</li></ul>
<p>(*) Unzutreffendes streichen.</p>', 'Übernahme aus dem Shopify-Shop (Stand 21.09.2026), noch ohne Ersetzung der Shopify-Nennungen', 'draft', null)
on conflict (document_id, locale, version) do nothing;
-- @@
insert into public.legal_documents (id, kind, path) values ('3d254eb5-d189-5a55-acd0-1e3acf75915e', 'datenschutz', '/policies/privacy-policy') on conflict (kind) do nothing;
-- @@
insert into public.legal_document_versions (id, document_id, version, title, body_html, change_note, status, effective_from)
  values ('44c1f21f-1c82-5150-a75e-1a0c7711f60b', '3d254eb5-d189-5a55-acd0-1e3acf75915e', 1, 'Datenschutzerklärung', '<h1>Datenschutzerklärung</h1>
<p>Letzte Fassung: 2. Juli 2026</p>
<p>Provibe betreibt diesen Shop und diese Website, einschließlich aller zugehörigen Informationen, Inhalte, Funktionen, Tools, Produkte und Services, um Ihnen als Kunde ein individuelles Einkaufserlebnis bereitzustellen (die „Services“). Provibe basiert auf Shopify, wodurch wir in der Lage sind, Ihnen die Services bereitzustellen. In dieser Datenschutzerklärung wird beschrieben, wie wir personenbezogene Daten erfassen, verwenden oder weitergeben, wenn Sie die Website besuchen, nutzen oder einen Kauf oder eine andere Transaktion unter Verwendung der Services tätigen oder anderweitig mit uns kommunizieren. Wenn es einen Konflikt zwischen unseren allgemeinen Geschäftsbedingungen und dieser Datenschutzerklärung gibt, hat diese Datenschutzerklärung Vorrang in Bezug auf die Erfassung, Verarbeitung und Weitergabe Ihrer personenbezogenen Daten.</p>
<p>Lesen Sie sich diese Datenschutzerklärung bitte sorgfältig durch. Indem Sie einen der Services nutzen und darauf zugreifen, bestätigen Sie, dass Sie diese Datenschutzerklärung gelesen haben und mit der Erfassung, Verwendung und Weitergabe Ihrer Daten, wie in dieser Datenschutzerklärung beschrieben, einverstanden sind.</p>
<h2>Welche personenbezogenen Daten erfassen oder verarbeiten wir?</h2>
<p>Wenn wir den Begriff „personenbezogene Daten“ verwenden, beziehen wir uns auf Informationen, die Sie oder eine andere Person identifizieren oder unmittelbar mit Ihnen in Verbindung gebracht werden können. Personenbezogene Daten umfassen keine Informationen, die anonym erfasst oder so anonymisiert wurden, dass eine Identifizierung oder eine Zuordnung zu Ihrer Person nicht möglich ist. Je nachdem, wie Sie mit den Services interagieren, wo Sie wohnen und wie es das geltende Recht erlaubt oder vorschreibt, können wir die folgenden Kategorien personenbezogener Daten erfassen oder verarbeiten, einschließlich der aus diesen personenbezogenen Daten gezogenen Rückschlüsse:</p>
<p>Kontaktdaten einschließlich Name, Postanschrift, Rechnungsadresse, Lieferadresse, Telefonnummer und E-Mail-Adresse.</p>
<p>Finanzdaten einschließlich Kredit-, Debitkarten- und Finanzkontonummern, Zahlungskarteninformationen, Finanzkontoinformationen, Transaktionsdetails, Zahlungsart, Zahlungsbestätigung und andere Zahlungsdetails.</p>
<p>Kontoinformationen darunter Benutzername, Passwort, Sicherheitsfragen, Konfigurationen und Einstellungen.</p>
<p>Transaktionsinformationen einschließlich der Artikel, die Sie sich ansehen, in den Warenkorb legen, auf die Wunschliste setzen oder kaufen, zurückgeben, umtauschen oder stornieren, sowie Ihre vergangenen Transaktionen.</p>
<p>Kommunikation mit uns einschließlich der Informationen, die Sie bei der Kommunikation mit uns angeben, beispielsweise wenn Sie eine Anfrage an den Kundensupport senden.</p>
<p>Geräteinformationen einschließlich Informationen über Gerät, Browser oder Netzwerkverbindung, IP-Adresse und andere eindeutige Identifikatoren.</p>
<p>Nutzungsinformationen einschließlich Informationen über Ihre Interaktion mit den Services, auch darüber, wie und wann Sie mit den Services interagieren oder sie durchsuchen.</p>
<h2>Quellen von personenbezogenen Daten</h2>
<p>Wir können personenbezogene Daten über die folgenden Quellen erfassen:</p>
<p>Direkt von Ihnen Wir erfassen die Daten unter anderem, wenn Sie ein Konto erstellen, die Services aufrufen oder nutzen, mit uns kommunizieren oder uns anderweitig Ihre personenbezogenen Daten zur Verfügung stellen.</p>
<p>Automatisch über die Services Wir erfassen die Daten unter anderem von Ihrem Gerät oder wenn Sie unsere Produkte oder Services nutzen oder unsere Website besuchen sowie über die Verwendung von Cookies und ähnlichen Technologien.</p>
<p>Von unseren Dienstanbietern Wir erfassen die Daten unter anderem, wenn wir die Dienstanbieter beauftragen, bestimmte Technologien zu aktivieren, und wenn sie Ihre personenbezogenen Daten in unserem Auftrag erfassen oder verarbeiten.</p>
<ul><li>Von unseren Partnern und anderen Drittanbietern</li></ul>
<h2>Wie verwenden wir Ihre personenbezogene Daten?</h2>
<p>Je nachdem, wie Sie mit uns interagieren oder welche der Services Sie nutzen, können wir personenbezogene Daten für die folgenden Zwecke verwenden:</p>
<p>Bereitstellung, Anpassung und Verbesserung der Services. Wir verwenden Ihre personenbezogenen Daten, um Ihnen die Services bereitzustellen. Das umfasst unter anderem die Erfüllung unseres Vertrags mit Ihnen, die Verarbeitung Ihrer Zahlungen, die Ausführung Ihrer Bestellungen, die Speicherung Ihrer Konfigurationen und der Artikel, für die Sie sich interessieren, die Versendung von Benachrichtigungen im Zusammenhang mit Ihrem Konto, die Erstellung, Pflege und sonstige Verwaltung Ihres Kontos, die Organisation des Versands, die Erleichterung von Rückgaben und Umtausch, die Möglichkeit, dass Sie Bewertungen abgeben, und die Schaffung eines individuellen Einkaufserlebnisses für Sie, indem wir Ihnen beispielsweise Produkte empfehlen, die sich an Ihren Käufen orientieren. Dazu kann auch die Verwendung Ihrer personenbezogenen Daten gehören, um die Services besser anzupassen und zu verbessern.</p>
<p>Marketing und Werbung. Wir verwenden Ihre personenbezogenen Daten für Marketing- und Werbezwecke, um beispielsweise Marketing- und Werbemitteilungen per E-Mail, SMS oder Post zu versenden und Ihnen online Werbung für Produkte oder Leistungen für die Services oder andere Websites anzuzeigen, auch auf der Grundlage von Artikeln, die Sie zuvor gekauft oder in Ihren Warenkorb gelegt haben, sowie anderen Aktivitäten in Bezug auf die Services.</p>
<p>Sicherheit und Betrugsprävention. Wir verwenden Ihre personenbezogenen Daten, um Ihr Konto zu authentifizieren, ein sicheres Zahlungs- und Einkaufserlebnis bereitzustellen, mögliche betrügerische, illegale, unsichere oder böswillige Aktivitäten aufzudecken, zu untersuchen oder Maßnahmen zu ergreifen, die öffentliche Sicherheit zu schützen und für die Sicherheit unserer Services zu sorgen. Wenn Sie sich entscheiden, die Services zu nutzen und ein Konto zu registrieren, sind Sie dafür verantwortlich, Ihre Kontoanmeldedaten zu schützen. Wir empfehlen dringend, dass Sie Ihren Benutzernamen, Ihr Passwort oder andere Zugangsdaten nicht an andere Personen weiterzugeben.</p>
<p>Kommunikation mit Ihnen. Wir verwenden Ihre personenbezogenen Daten, um Ihnen Kundensupport und effektive Services bereitzustellen, zeitnah auf Ihre Anfragen zu reagieren und unsere Geschäftsbeziehung mit Ihnen aufrechtzuerhalten.</p>
<p>Rechtliche Gründe. Wir verwenden Ihre personenbezogenen Daten, um geltendes Recht einzuhalten oder auf rechtmäßige Verfahrensschritte zu reagieren, einschließlich Anfragen von Strafverfolgungs- oder Aufsichtsbehörden, um zivilrechtliche Ermittlungen, potenzielle oder konkrete Rechtsstreitigkeiten oder andere kontradiktorische Verfahren zu untersuchen oder daran teilzunehmen und um potenzielle Verstöße gegen unsere Bedingungen oder Richtlinien zu untersuchen oder die Bedingungen und Richtlinien durchzusetzen.</p>
<h2>Wie geben wir personenbezogene Daten weiter?</h2>
<p>Unter bestimmten Umständen können wir Ihre personenbezogenen Daten für legitime Zwecke gemäß dieser Datenschutzerklärung an Dritte weitergeben. Solche Umstände können Folgendes umfassen:</p>
<ul><li>Bei Shopify sind dies Anbieter und andere Dritte, die in unserem Auftrag Services erbringen (z. B. IT-Management, Zahlungsabwicklung, Datenanalyse, Kundensupport, Cloud-Speicher, Fulfillment und Versand).</li></ul>
<p>Wir geben personenbezogene Daten an Geschäfts- und Marketingpartner weiter, die für Sie Marketingservices erbringen und Ihnen Werbung anzeigen. Wir nutzen Shopify beispielsweise, um personalisierte Werbung mit Services von Drittanbietern zu unterstützen, die auf Ihren Online-Aktivitäten bei verschiedenen Händlern und Websites basieren. Unsere Geschäfts- und Marketingpartner verwenden Ihre Daten gemäß ihren eigenen Datenschutzerklärungen. Je nach Ihrem Wohnort haben Sie möglicherweise das Recht, uns anzuweisen, keine Informationen über Sie weiterzugeben, um Ihnen gezielte Werbung und Marketing auf der Grundlage Ihrer Online-Aktivitäten bei verschiedenen Händlern und Websites anzuzeigen.</p>
<ul><li>Wenn Sie uns auffordern oder anderweitig Ihre Zustimmung geben, bestimmte Informationen an Dritte weiterzugeben, beispielsweise um Ihnen Produkte zu liefern, oder wenn Sie Social-Media-Widgets oder Login-Integrationen nutzen.</li></ul>
<ul><li>Wir geben personenbezogene Daten an unsere Affiliates oder anderweitig innerhalb unserer Unternehmensgruppe weiter.</li></ul>
<ul><li>Im Zusammenhang mit einer geschäftlichen Transaktion wie einer Fusion oder Insolvenz, zur Einhaltung geltender gesetzlicher Verpflichtungen (einschließlich der Reaktion auf Vorladungen, Durchsuchungsbeschlüsse und ähnliche Anfragen), zur Durchsetzung geltender Servicebedingungen oder Richtlinien und zum Schutz oder zur Verteidigung der Services, unserer Rechte und der Rechte unserer Nutzer oder anderer.</li></ul>
<h2>Beziehung mit Shopify</h2>
<p>Die Services werden von Shopify gehostet, wobei Shopify personenbezogene Daten über Ihren Zugriff auf die Services und deren Nutzung erfasst und verarbeitet, um Ihnen die Services bereitzustellen und zu verbessern. Daten, die Sie an die Services übermitteln, werden an Shopify sowie an Dritte weitergegeben, die sich möglicherweise in anderen Ländern als dem Land Ihres Wohnsitzes befinden, um die Services für Sie bereitzustellen und zu verbessern. Um unser Geschäft zu schützen, zu erweitern und zu verbessern, verwenden wir außerdem bestimmte erweiterte Shopify-Funktionen, die Daten und Informationen aus Ihren Interaktionen mit unserem Shop, mit anderen Händlern und mit Shopify einbeziehen. Um diese erweiterten Funktionen bereitzustellen, kann Shopify personenbezogene Daten verwenden, die über Ihre Interaktionen mit unserem Shop, anderen Händlern und Shopify erfasst wurden. Unter diesen Umständen ist Shopify für die Verarbeitung Ihrer personenbezogenen Daten verantwortlich, einschließlich der Beantwortung Ihrer Anfragen zur Ausübung Ihrer Rechte bezüglich der Verwendung Ihrer personenbezogenen Daten für diese Zwecke. Weitere Informationen darüber, wie Shopify Ihre personenbezogenen Daten verwendet und welche Rechte Sie haben, finden Sie in der <a href="https://www.shopify.com/legal/privacy/app-users">Shopify Datenschutzrichtlinie für Verbraucher</a> . Abhängig davon, wo Sie Ihren Wohnsitz haben, können Sie hier bestimmte Rechte in Bezug auf Ihre hier aufgeführten personenbezogenen Daten ausüben <a href="https://privacy.shopify.com/en">Link zum Shopify-Datenschutzportal</a>.</p>
<h2>Websites und Links von Drittanbietern</h2>
<p>Die Services können Links zu Websites oder anderen Online-Plattformen bereitstellen, die von Drittanbietern betrieben werden. Wenn Sie Links zu Websites folgen, die keine Affiliate-Websites sind oder nicht von uns kontrolliert werden, sollten Sie deren Datenschutz- und Sicherheitsrichtlinien sowie sonstige Geschäftsbedingungen überprüfen. Wir übernehmen keine Garantie und sind nicht verantwortlich für den Datenschutz oder die Sicherheit solcher Websites, einschließlich der Genauigkeit, Vollständigkeit oder Zuverlässigkeit der auf diesen Websites befindlichen Informationen. Informationen, die Sie an öffentlichen oder halböffentlichen Orten bereitstellen, einschließlich der Informationen, die Sie auf Social Networking-Plattformen von Drittanbietern weitergeben, können auch von anderen Nutzern der Services und/oder Nutzern dieser Drittanbieter-Plattformen eingesehen werden, ohne Einschränkungen in Bezug auf deren Nutzung durch uns oder durch einen Drittanbieter. Die Aufnahme solcher Links durch uns bedeutet nicht, dass wir die Inhalte dieser Plattformen oder deren Eigentümer oder Betreiber unterstützen, es sei denn, dies ist in den Services ausdrücklich erwähnt.</p>
<h2>Daten von Kindern</h2>
<p>Die Services sind nicht für die Nutzung durch Kinder gedacht, und wir erfassen wissentlich keine personenbezogenen Daten von Kindern, die in Ihrem Land noch nicht volljährig sind. Wenn Sie die Eltern oder der Vormund eines Kindes sind, das uns seine personenbezogenen Daten zur Verfügung gestellt hat, können Sie sich über die unten angegebenen Kontaktdaten mit uns in Verbindung setzen, um die Löschung dieser Daten zu verlangen. Zum Zeitpunkt des Inkrafttretens dieser Datenschutzerklärung haben wir keine Kenntnis davon, dass wir personenbezogene Daten von Personen unter 16 Jahren „weitergeben“ oder „verkaufen“ (gemäß der Definition dieser Begriffe im geltenden Recht).</p>
<h2>Sicherheit und Aufbewahrung Ihrer Daten</h2>
<p>Bitte beachten Sie, dass keine Sicherheitsmaßnahmen perfekt oder undurchdringlich sind, und wir daher keine „perfekte Sicherheit“ garantieren können. Zudem können auch Informationen, die Sie uns senden, während der Übertragung Risiken ausgesetzt sein. Wir empfehlen Ihnen, bei der Übermittlung sensibler oder vertraulicher Informationen an uns keine unsicheren Kanäle zu verwenden.</p>
<p>Wie lange wir Ihre personenbezogenen Daten aufbewahren, hängt von verschiedenen Faktoren ab. Dazu gehören beispielsweise die Frage, ob wir die Daten benötigen, um Ihr Konto zu verwalten, Ihnen Services zur Verfügung zu stellen, rechtlichen Verpflichtungen nachzukommen, Streitigkeiten beizulegen oder andere geltende Verträge und Richtlinien durchzusetzen.</p>
<h2>Ihre Rechte und Möglichkeiten</h2>
<p>Je nachdem, wo sich Ihr Wohnsitz befindet, haben Sie möglicherweise einige oder alle der unten aufgeführten Rechte in Bezug auf Ihre personenbezogene Daten. Diese Rechte sind jedoch nicht absolut, gelten möglicherweise nur unter bestimmten Umständen, und in bestimmten Fällen können wir Ihre Anfrage im gesetzlich zulässigen Rahmen ablehnen.</p>
<p>Recht auf Zugang/Auskunft. Sie haben möglicherweise das Recht, Einsicht in die personenbezogenen Daten zu verlangen, die wir über Sie gespeichert haben.</p>
<p>Recht auf Löschung. Sie haben möglicherweise das Recht, von uns die Löschung der über Sie gespeicherten personenbezogenen Daten zu verlangen.</p>
<p>Recht auf Berichtigung. Sie haben möglicherweise das Recht, von uns die Berichtigung fehlerhafter personenbezogenen Daten zu verlangen, die wir über Sie gespeichert haben.</p>
<p>Recht auf Datenübertragbarkeit. Sie haben möglicherweise das Recht, eine Kopie der personenbezogenen Daten, die wir über Sie gespeichert haben, zu erhalten und zu verlangen, dass wir sie unter bestimmten Umständen und mit bestimmten Ausnahmen an einen Dritten weitergeben.</p>
<p>Verwaltung von Kommunikationseinstellungen. Wir können Ihnen Werbe-E-Mails zusenden. Sie können dem Erhalt dieser E-Mails jederzeit widersprechen, indem Sie die Option zum Abbestellen nutzen, die in unseren E-Mails an Sie enthalten ist. Wenn Sie sich dagegen entscheiden, können wir Ihnen weiterhin nicht werbliche E-Mails schicken, z. B. über Ihr Konto oder über Bestellungen, die Sie getätigt haben.</p>
<p>Wenn Sie sich Ihr Wohnsitz im Vereinigten Königreich oder im Europäischen Wirtschaftsraum befindet, können Sie vorbehaltlich der Ausnahmen und Beschränkungen durch das lokale Recht zusätzlich zu den oben genannten Rechten die folgenden Rechte ausüben:</p>
<p>Recht auf Widerspruch und Recht auf Einschränkung der Verarbeitung. Sie haben möglicherweise das Recht, von uns zu verlangen, dass wir die Verarbeitung personenbezogener Daten für bestimmte Zwecke einstellen oder einschränken.</p>
<p>Widerruf der Einwilligung. Sofern wir uns auf eine Einwilligung zur Verarbeitung Ihrer personenbezogenen Daten stützen, haben Sie das Recht, diese Einwilligung zu widerrufen. Wenn Sie Ihre Einwilligung widerrufen, hat dies keinen Einfluss auf die Rechtmäßigkeit der Verarbeitung, die auf Ihrer Einwilligung vor dem Widerruf beruht.</p>
<p>Sie können diese Rechte ausüben, wenn dies in den Services entsprechend angegeben ist, oder indem Sie sich über die unten angegebenen Kontaktdaten mit uns in Verbindung setzen. Mehr Informationen darüber, wie Shopify Ihre personenbezogenen Daten verwendet und welche Rechte Sie haben, einschließlich der Rechte in Bezug auf die von Shopify verarbeiteten Daten, finden Sie unter https://privacy.shopify.com/en.</p>
<p>Durch die Ausübung dieser Rechte entstehen Ihnen keinerlei Nachteile. Sofern dies nach geltendem Recht zulässig oder erforderlich ist, müssen wir möglicherweise Ihre Identität überprüfen, bevor wir Ihre Anfragen verarbeiten können. In Übereinstimmung mit geltenden Gesetzen können Sie einen Bevollmächtigten benennen, der in Ihrem Namen Anfragen zur Ausübung Ihrer Rechte stellt. Bevor wir eine solche Anfrage von einem Vertreter annehmen, verlangen wir von diesem den Nachweis, dass Sie ihn bevollmächtigt haben, in Ihrem Namen zu handeln. Dabei kann es erforderlich sein, dass Sie Ihre Identität direkt uns gegenüber bestätigen müssen. Wir werden Ihre Anfrage im Rahmen des geltenden Rechts zügig beantworten.</p>
<h2>Beschwerden</h2>
<p>Wenn Sie Beschwerden darüber haben, wie wir Ihre personenbezogenen Daten verarbeiten, wenden Sie sich bitte über die unten angegebenen Kontaktdaten an uns. Je nachdem, wo sich Ihr Wohnsitz befindet, haben Sie das Recht, gegen unsere Entscheidung Einspruch zu erheben, indem Sie sich unter den unten angegebenen Kontaktdaten an uns wenden oder Ihre Beschwerde bei der zuständigen Datenschutzbehörde einreichen. Für den Europäischen Wirtschaftsraum gibt es eine Liste der zuständigen Datenschutzaufsichtsbehörden. Wenn Sie sich abrufen möchten, <a href="https://edpb.europa.eu/about-edpb/about-edpb/members">haben Sie hier die Möglichkeit dazu</a>.</p>
<h2>Internationale Übertragungen</h2>
<p>Beachten Sie, dass wir Ihre personenbezogenen Daten möglicherweise außerhalb des Landes, in dem sich Ihr Wohnsitz befindet, übertragen, speichern und verarbeiten.</p>
<p>Wenn wir Ihre personenbezogenen Daten außerhalb des Europäischen Wirtschaftsraums oder des Vereinigten Königreichs übermitteln, stützen wir uns auf anerkannte Übermittlungsmechanismen wie die Standardvertragsklauseln der Europäischen Kommission oder gleichwertige Verträge, die von der jeweils zuständigen Behörde des Vereinigten Königreichs herausgegeben werden, es sei denn, die Datenübermittlung erfolgt in ein Land, das nachweislich ein angemessenes Schutzniveau bietet.</p>
<h2>Änderungen an dieser Datenschutzerklärung</h2>
<p>Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren, um beispielsweise Änderungen unserer Verfahrensweisen zu berücksichtigen, oder aus anderen betrieblichen, rechtlichen oder regulatorischen Gründen. Wir veröffentlichen die überarbeitete Datenschutzerklärung auf dieser Website, passen das Datum der „Letzten Fassung“ entsprechend an und machen die nach geltendem Recht erforderliche Mitteilung.</p>
<h2>Kontakt</h2>
<p>Sollten Sie Fragen zu unseren Datenschutzverfahren oder dieser Datenschutzerklärung haben, oder wenn Sie eines der Ihnen zustehenden Rechte ausüben möchten, wenden Sie sich bitte telefonisch unter +491629231702, per E-Mail unter hello@provibe-drinks.de oder per Post an Provibe, Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland an uns. Im Sinne der geltenden Datenschutzgesetze sind wir der Datenverantwortliche für Ihre personenbezogenen Daten.</p>', 'Übernahme aus dem Shopify-Shop (Stand 21.09.2026), noch ohne Ersetzung der Shopify-Nennungen', 'draft', null)
on conflict (document_id, locale, version) do nothing;
-- @@
insert into public.legal_documents (id, kind, path) values ('67dc0543-e768-58f9-adb2-b573476601e2', 'versand', '/pages/versand') on conflict (kind) do nothing;
-- @@
insert into public.legal_document_versions (id, document_id, version, title, body_html, change_note, status, effective_from)
  values ('7b280b6d-a57a-5c47-a927-fcc1d4004e63', '67dc0543-e768-58f9-adb2-b573476601e2', 1, 'Versand', '<p>Versand</p>
<p>Zahlung und Versand</p>
<p>Es gelten folgende Bedingungen:</p>
<p>Die Lieferung erfolgt nur im Inland (Deutschland).</p>
<p>Versandkosten (inklusive gesetzliche Mehrwertsteuer)</p>
<p>Wir berechnen die Versandkosten pauschal mit 4,90 € pro Bestellung.</p>
<p>Ab einem Bestellwert von 50,00 € liefern wir versandkostenfrei.</p>
<p>Lieferfristen</p>
<p>Soweit im jeweiligen Angebot keine andere Frist angegeben ist, erfolgt die Lieferung der Ware im Inland (Deutschland) innerhalb von 3 - 5 Werktagen nach Vertragsschluss (bei vereinbarter Vorauszahlung nach dem Zeitpunkt Ihrer Zahlungsanweisung). Im Pre-Sale ist mit einer lieferzeit von 6-8 Wochen zu rechnen.</p>
<p>Beachten Sie, dass an Sonn- und Feiertagen keine Zustellung erfolgt.</p>
<p>Haben Sie Artikel mit unterschiedlichen Lieferzeiten bestellt, wird die Ware in einer gemeinsamen Sendung versandt, sofern wir keine abweichenden Vereinbarungen mit Ihnen getroffen haben. Die Lieferzeit bestimmt sich in diesem Fall nach dem Artikel mit der längsten Lieferzeit den Sie bestellt haben.</p>
<p>Akzeptierte Zahlungsmöglichkeiten</p>
<ul><li>Zahlung per Kreditkarte</li></ul>
<ul><li>Zahlung per PayPal</li></ul>
<ul><li>Zahlung per Banküberweisung</li></ul>
<p>Weitere Einzelheiten zur Zahlung</p>
<p>Bei Zahlung per Kreditkarte erfolgt die Belastung Ihres Kreditkartenkontos mit Vertragsschluss.</p>
<p>Bei Fragen finden Sie unsere Kontaktdaten im Impressum.</p>', 'Übernahme aus dem Shopify-Shop (Stand 21.09.2026), noch ohne Ersetzung der Shopify-Nennungen', 'draft', null)
on conflict (document_id, locale, version) do nothing;
-- @@
insert into public.pages (id, handle, template, status, noindex, show_in_sitemap) values ('20d20bbe-a0ce-57d0-a2bc-ca60c04d0973', 'shop', 'shop', 'draft', false, true) on conflict (handle) do nothing;
-- @@
insert into public.page_translations (page_id, locale, title, body_html) values ('20d20bbe-a0ce-57d0-a2bc-ca60c04d0973', 'de', 'Shop', '<p>Unsere Produkte</p>
<h1>get the vibe</h1>
<p>Probier provibe – erfrischender Eistee mit 15 g Protein.</p>
<p><a href="/collections/all">Jetzt shoppen</a></p>
<p><a href="/collections/alle-produkte">All</a></p>
<p><a href="/collections/eistee">Eistee</a></p>
<p><a href="/collections/aktion">Aktionen</a></p>
<p>Produkte</p>
<p>[Wildberry Eistee</p>
<p>€26,10](/products/wildberry)</p>
<p>In den Warenkorb</p>
<p>[Peach Eistee</p>
<p>€26,10](/products/peach)</p>
<p>In den Warenkorb</p>
<p>[Raspberry-Lime Eistee</p>
<p>€26,10](/products/raspberry-lime)</p>
<p>In den Warenkorb</p>
<p>[provibe Eistee mixed</p>
<p>€26,10](/products/provibe-eistee-mixed)</p>
<p>In den Warenkorb</p>
<p>[Founder Bundle ll</p>
<p>€45,80](/products/founder-bundle-ii)</p>
<p>In den Warenkorb</p>
<p>[Founder Bundle l</p>
<p>€35,80](/products/founder-bundle-i)</p>
<p>In den Warenkorb</p>
<p>[Founder Bundle lll</p>
<p>€57,40](/products/founder-bundle-iii-1)</p>
<p>In den Warenkorb</p>
<p>[Eistee</p>
<p>Alle ansehen →](/collections/eistee)[Founder Bundles</p>
<p>Alle ansehen →](/collections/aktion)[Produkte</p>
<p>Alle ansehen →](/collections/alle-produkte)</p>') on conflict (page_id, locale) do nothing;
-- @@
insert into public.pages (id, handle, template, status, noindex, show_in_sitemap) values ('b7d9050a-317f-5df3-af9f-6f30a294067e', 'uber-uns', 'about', 'draft', false, true) on conflict (handle) do nothing;
-- @@
insert into public.page_translations (page_id, locale, title, body_html) values ('b7d9050a-317f-5df3-af9f-6f30a294067e', 'de', 'Über uns', '<p>01</p>
<h2>Die Idee</h2>
<p>Ich wollte eine Alternative zu dickflüssigen Proteinshakes und künstlich süßen Clear-Whey Produkten. Daraus ist ist Idee für Eistee mit Protein entstanden. Während meinem Studium habe ich also angefangen zu recherchieren...</p>
<p>02</p>
<h2>Die Entwicklung</h2>
<p>Von der ersten Rezeptur bis zum Dosen-Design: Ich habe gemeinsam mit erfahrenen Lebensmittelexperten an der perfekten Rezeptur gearbeitet. Für einen leckeren, erfrischenden Eistee mit 15g hochwertigem Protein, ohne Zucker und mit natürlichen Inhaltsstoffen.</p>
<p>03</p>
<h2>Unsere Vision</h2>
<p>Eine Gründerin und drei Sorten: Ich möchte es mit provibe schaffen, ausgewogene Ernährung im Alltag leicht und lecker zu machen. Protein soll endlich als mehr gesehen werden, als nur ein Sportnahrungsmittel - es ist schließlich einer der wichtigsten Nährstoffe für unseren Körper.</p>') on conflict (page_id, locale) do nothing;
-- @@
insert into public.pages (id, handle, template, status, noindex, show_in_sitemap) values ('330b2571-5dfa-5750-a337-a6b6ca9ce26b', 'partner', 'partner', 'draft', false, true) on conflict (handle) do nothing;
-- @@
insert into public.page_translations (page_id, locale, title, body_html) values ('330b2571-5dfa-5750-a337-a6b6ca9ce26b', 'de', 'Partner', '<p>für Partner</p>
<h1>Provibe für dein Geschäft oder Gym</h1>
<p>Egal ob Fitnessstudio, Functional Training Area, Einzelhandel, Gastronomie oder Hotellerie – wir beliefern unsere B2B-Partner direkt und unkompliziert. Der provibe Eistee passt überall dorthin, wo Menschen ein erfrischendes, proteinreiches Getränk suchen, das sich leicht in den Alltag integrieren lässt.</p>
<h3>Deine Vorteile</h3>
<ul><li>attraktive Konditionen</li></ul>
<ul><li>flexible Bestellmengen – ideal für Tests &amp; Erstbestellungen</li></ul>
<ul><li>unkomplizierte Abwicklung</li></ul>
<ul><li>ein Produkt, das bei deinen Kund:innen garantiert gut ankommt</li></ul>
<p>´-</p>
<h2>Wir freuen uns auf deine Anfrage</h2>
<p>Du möchtest provibe für deinen Standort bestellen oder vorab mehr über Konditionen, Mengen &amp; Abläufe erfahren?</p>
<p>📩 <a href="mailto:partner@provibe-drinks.de">partner@provibe-drinks.de</a></p>
<p>Wir arbeiten bereits mit ersten Partnern zusammen und erweitern unser Netzwerk Schritt für Schritt.</p>
<p>Senden</p>') on conflict (page_id, locale) do nothing;
-- @@
insert into public.pages (id, handle, template, status, noindex, show_in_sitemap) values ('d14d47be-2601-50b1-a540-e043314127ab', 'contact', 'contact', 'draft', false, true) on conflict (handle) do nothing;
-- @@
insert into public.page_translations (page_id, locale, title, body_html) values ('d14d47be-2601-50b1-a540-e043314127ab', 'de', 'Kontakt', '<p>Kontakt</p>
<h1>Wir sind für dich da</h1>
<p>Kontakt</p>
<p>Egal ob Fragen, Feedback oder geschäftliche Anfragen – wir melden uns innerhalb von 24 Stunden zurück.</p>
<p>📩 <a href="mailto:hello@provibe-drinks.de">hello@provibe-drinks.de</a></p>
<p>Senden</p>') on conflict (page_id, locale) do nothing;
-- @@
insert into public.pages (id, handle, template, status, noindex, show_in_sitemap) values ('297acd14-0b19-5906-af5d-7b8d3b941a95', 'messe', 'investors', 'draft', true, false) on conflict (handle) do nothing;
-- @@
insert into public.page_translations (page_id, locale, title, body_html) values ('297acd14-0b19-5906-af5d-7b8d3b941a95', 'de', 'Messe', '<h1>Eistee mit Protein.Funktion, die sich wie Sommer anfühlt.</h1>
<p>Der erste Protein-Eistee, der zuerst über Geschmack überzeugt – trinkfertig, zuckerfrei, 100 % natürlich. Eine neue Kategorie für eine breite Alltags-Zielgruppe.</p>
<p><a href="#deck">Pitch Deck anfragen</a></p>
<p><a href="#termin">Termin mit Celine</a></p>
<p>15 g Protein0 g Zucker</p>
<p>100 % natürlichMade in Germany</p>
<p>15 g</p>
<p>Protein / Dose</p>
<p>0 g</p>
<p>Zucker</p>
<p>100 %</p>
<p>natürlich</p>
<p>RTD</p>
<p>trinkfertig</p>
<p>Das Produkt</p>
<h2>Protein, das sich endlich erfrischend anfühlt.</h2>
<p>Die meisten Protein-Produkte schmecken nach Funktion. provibe dreht das um: erst der erfrischende Eistee-Moment – das Protein kommt einfach mit. Ein Getränk für den Alltag, nicht nur für die Sporttasche.</p>
<p>01</p>
<h3>Funktional</h3>
<p>15 g hochwertiges Protein pro Dose – trinkfertig, ohne Anmischen, ohne dickflüssige Konsistenz.</p>
<p>02</p>
<h3>Transparent</h3>
<p>0 g Zucker, 100 % natürliche Inhaltsstoffe, laktosefrei und in Deutschland produziert.</p>
<p>03</p>
<h3>Alltagstauglich</h3>
<p>Erfrischend statt Shake. Ein Produkt, das Geschmack und Lebensgefühl in den Mittelpunkt stellt – nicht Leistung.</p>
<p>Das Problem</p>
<h2>Fitnessklischee Protein</h2>
<p>Zwischen 70% und 80% der Menschen in Europa nehmen am Tag weniger als die empfohlene Mindestmenge (1,5g/kg Körpergewicht) an Proteinen zu sich. Diese sind wie die Bausteine für unseren Körper und sowohl essentiell für Muskeln, als auch unseren Stoffwechsel, unser Immunsystem und als Energiequelle. Trotzdem werden Sie weiterhin von Vielen als reines Mittel zum Muskelaufbau gesehen.</p>
<p>01</p>
<h3>Fehlende Frische</h3>
<p>Die meisten Proteinshakes basieren auf Milch und sind somit sehr mächtig.</p>
<p>02</p>
<h3>Proteinreich ≠ Fitness</h3>
<p>Protein ist für jeden Mensch ein wichtiger Nährstoff - trotzdem ist die angesprochene Zielgruppe oft sportlich geprägt.</p>
<p>03</p>
<h3>Künstlicher Geschmack</h3>
<p>Die wasserbasierten “Clear Whey”-Drinks haben meist einen künstlichen Eigengeschmack und sind in den meisten Fällen ausschließlich als Pulver erhältlich.</p>
<p>Zielgruppe &amp; Marktpotenzial</p>
<h2>Mehr Lifestyle - weniger Sport</h2>
<p>provibe richtet sich bewusst nicht an die enge Fitness-Bubble, sondern den deutlich größeren Lifestyle-Bereich: gesundheitsbewusste Menschen zwischen 20 und 35 Jahren mit aktivem, urbanem Lebensstil, die funktionale Getränke fest in ihren Alltag integrieren und dafür auch einen Premium-Preis zahlen. Sie suchen eine leichte, trinkfertige Alternative zu Softdrinks und klassischen Fitnessshakes – proteinreich aber zuckerfrei und mit natürlichem Geschmack. Genau in dieser Kombination liegt das skalierbare Volumen in einer noch wenig besetzten Lücke.</p>
<p>Kernzielgruppe</p>
<h3>Bewusste Genießer</h3>
<p>Marken- und designaffine Konsument:innen, die Inhaltsstoffe und Ästhetik gleichermaßen wichtig finden und Marken bewusst nach Lebensgefühl auswählen. Für sie ist provibe kein Supplement, sondern ein besseres Alltagsgetränk.</p>
<p>Relevanz: hohe Zahlungsbereitschaft, starke Markenbindung und Wiederkäufe im D2C-Geschäft.</p>
<p>Volumen-Treiber</p>
<h3>Berufstätige &amp; Studierende</h3>
<p>Die breite, alltagsgetriebene Masse, die trinkfertige Lösungen für Schreibtisch, Uni und unterwegs braucht und primär nach Convenience und Funktionalität kauft. Weniger markenverliebt mit Fokus auf das Produkt selbst.</p>
<p>Relevanz: Trägt Absatzmengen für die spätere Listung im Einzelhandel.</p>
<p>Brückensegment</p>
<h3>Casual-Fitness</h3>
<p>Menschen, die regelmäßig trainieren und Erfrischung statt dickflüssigem Shake wollen. Zu Ihnen entsteht der direkte Kontakt über Kooperationen mit Fitnessstudios.</p>
<p>Relevanz: Planbarer Erstvertrieb mit geringen Streuverlusten.</p>
<p>Ein Massenmarkt im Alltag – nicht eine Nische im Gym. Eine klar umrissene Zielgruppe, die über digitale Kanäle und Fitness-Partner skalierbar wird.</p>
<p>Die Produkte</p>
<h2>Drei Sorten.</h2>
<p>Drei Geschmacksrichtungen: Von basic bis neu gedacht - für alle ist etwas dabei.</p>
<p>01 · Der Erfrischende</p>
<h3>Raspberry-Lime</h3>
<p>Limette trifft fruchtige Himbeere – leicht sauer, perfekt für den Sommer.</p>
<p>330 ML</p>
<p>02 · Der Klassiker</p>
<h3>Peach</h3>
<p>Der klassische Eistee mit süßer, sonnengereifter Pfirsichnote. Super erfrischend.</p>
<p>330 ML</p>
<p>03 · Der Fruchtige</p>
<h3>Wildberry</h3>
<p>Eine wilde Mischung aus Beeren – süß, saftig und intensiv fruchtig.</p>
<p>330 ML</p>
<p>Die Gründerin</p>
<h2>Wie aus einem Problem eine Marke wurde.</h2>
<p>„Warum gibt es eigentlich keinen Eistee mit Protein, der wirklich gut schmeckt?"</p>
<p>Sommer 2024: Nach dem Training keine Lust mehr auf das ständige Anmischen, die dickflüssige Konsistenz und den künstlich süßen Geschmack der üblichen Protein-Drinks.</p>
<p>Eigentlich wollte ich lieber einen erfrischenden Eistee in der Sonne trinken. Genau aus diesem Gedanken ist provibe entstanden – ein Eistee mit Protein, der Geschmack und Funktion verbindet.</p>
<p>— Celine, Gründerin</p>
<p>27 Prototypen· 12 Monate Entwicklung</p>
<p>Markt &amp; USP</p>
<h2>Was provibe einzigartig macht.</h2>
<p>provibe ist der erste Eistee mit Protein, der funktionale Erfrischung, natürlichen Geschmack und hochwertige Makronährstoffe in einem trinkfertigen Getränk vereint – und sich klar vom Sport- und Shake-Segment abgrenzt.</p>
<h3>Lifestyle statt Leistung</h3>
<p>Positioniert im Alltag, nicht im Gym: proteinreiche Erfrischung für eine breite Zielgruppe statt Sportlernahrung für eine Nische.</p>
<h3>All-in-one Erfrischung</h3>
<p>Funktionale Erfrischung, neuer Geschmack und 15 g Protein in einer 330ml-Dose – wasserbasiert statt mächtig und milchig.</p>
<h3>Markt-Lücke</h3>
<p>Der erste Protein-Eistee, der zuerst über Geschmack &amp; Lifestyle überzeugt – während Wettbewerber auf Sportnahrung, Mahlzeitersatz oder Wellness setzen.</p>
<h3>Doppelter Konsumtrend</h3>
<p>Mehr Protein und weniger Zucker – zwei der stärksten Wachstumstreiber, gebündelt in einem ready-to-drink Format.</p>
<h3>Clean Label, Made in Germany</h3>
<p>0 g Zucker, 100 % natürliche Inhaltsstoffe und 15 g Protein aus hochwertigem Molkeproteinisolat – produziert in Deutschland.</p>
<h3>Smart &amp; skalierbar</h3>
<p>Kompaktes On-the-Go-Format und klare Markenwelt – als Basis für D2C, Fitnessstudios und den Einzelhandel.</p>
<p>Marktpotential</p>
<h2>Warum jetzt?</h2>
<p>Getränkemarkt&gt; 570 Mio. €</p>
<p>für funktionale RTD Getränke in Deutschland</p>
<p>Konsumenten innerh. des Markts12 Millionen</p>
<p>die regelmäßig funktionale Getränke konsumieren</p>
<p>Jährliche Wachstumsrate (CAGR)12 %</p>
<p>für den RTD-Funktionsgetränkemarkt</p>
<p>Pitch Deck</p>
<h2>Das vollständige Pitch Deck.</h2>
<p>Zahlen, Roadmap, Strategie und Vision im Detail. Trag deine E-Mail ein – Celine schickt dir das komplette Deck direkt zu.</p>
<p>Deck anfordern</p>
<p>Wir nutzen deine E-Mail ausschließlich, um dir das Pitch Deck zu senden.</p>
<p>Danke! Celine meldet sich in Kürze mit dem Pitch Deck.</p>
<p>Direkt aus erster Hand</p>
<h2>Lieber direkt sprechen?</h2>
<p>Buch dir einen Termin mit Celine und stell deine Fragen persönlich – zu Produkt, Markt und Roadmap.</p>
<p><a href="#">Termin mit Celine buchen</a></p>
<p>Eistee mit Protein.</p>
<p><a href="https://instagram.com/provibe.de">provibe.de</a></p>
<p><a href="https://tiktok.com/@provibe.de">provibe.de</a></p>
<p><a href="mailto:hello@provibe-drinks.de">hello@provibe-drinks.de</a></p>
<p><a href="#deck">→ Pitch Deck anfragen</a><a href="#termin">→ Termin mit Celine</a><a href="https://provibe-drinks.de">→ provibe-drinks.de</a></p>
<p>© 2025 provibe · Eistee mit Protein · 0 g Zucker · 100 % natürlich · produziert in Deutschland. *Empfohlene Tagesmenge 3 Dosen.</p>
<p>provibe · Eistee mit Protein<a href="#termin">Termin buchen</a><a href="#deck">Pitch Deck</a></p>') on conflict (page_id, locale) do nothing;
-- @@
insert into public.pages (id, handle, template, status, noindex, show_in_sitemap) values ('7149a05b-6e6e-5102-a06e-a262df31a6ff', 'widerruf-formular', 'withdrawal', 'draft', false, true) on conflict (handle) do nothing;
-- @@
insert into public.page_translations (page_id, locale, title, body_html) values ('7149a05b-6e6e-5102-a06e-a262df31a6ff', 'de', 'Widerruf', '<h2>Widerruf erklären</h2>
<p>Füllen Sie das folgende Formular aus, um Ihre Widerrufserklärung abzugeben.</p>
<p><a href="https://apps.shopify.com/eu-widerrufsbutton">Shopify EU Widerrufsbutton App</a></p>') on conflict (page_id, locale) do nothing;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'founder-bundle-iii-1', 'draft', 'bundle', 'provibe', 'Bundle', array['bundle','aktion']::text[], false, 0, 'Stück', null, 'piece', 'piece', null, '{}'::jsonb, 10857146843463, 0, '2026-06-16T00:14:06+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'de', 'Founder Bundle III', null, '<p data-end="37" data-start="0"><strong data-end="37" data-start="0">Das ultimative provibe Bundle!</strong></p>
<p data-end="259" data-start="39">Für alle, die provibe nicht nur trinken, sondern auch leben möchten: Dieses Bundle kombiniert unsere beliebtesten Eistee-Sorten mit exklusivem Merchandise und bringt die volle provibe Experience direkt zu dir nach Hause.</p>
<p data-end="487" data-start="261">Enthalten sind jeweils <strong data-end="354" data-start="284">2 Dosen unserer drei Sorten Pfirsich, Wildberry und Raspberry Lime</strong>, unser hochwertiger <strong data-end="398" data-start="375">provibe Trinkbecher</strong> sowie das beliebte <strong data-end="463" data-start="418">„Looks Like You Have Great Taste“ T-Shirt</strong> im bequemen Unisex-Fit.</p>
<p data-end="645" data-start="489">Ob unterwegs, beim Sport, im Büro oder mit Freunden – mit dem passenden Becher in der Hand und dem provibe-Shirt als Statement bist du bestens ausgestattet.</p>
<p data-end="658" data-start="647"><strong data-end="658" data-start="647">Inhalt:</strong></p>
<ul data-end="825" data-start="659">
<li data-end="681" data-start="659" data-section-id="w2fts4">2 × provibe Peach</li>
<li data-end="705" data-start="682" data-section-id="1q50oy8">2 × provibe Wildberry</li>
<li data-end="734" data-start="706" data-section-id="1gmpfy3">2 × provibe Raspberry-Lime</li>
<li data-end="760" data-start="735" data-section-id="cmhhxm">1 × provibe cup</li>
<li data-end="825" data-start="761" data-section-id="tkcgu5">1 × provibe T-Shirt „Looks like you have great taste“ (Unisex)</li>
</ul>
<p data-is-only-node="" data-is-last-node="" data-end="965" data-start="827">Das perfekte Bundle für alle, die die provibe-Welt in ihrer ganzen Vielfalt erleben möchten – zum Genießen, Tragen und Teilen.</p>
<p data-is-only-node="" data-is-last-node="" data-end="965" data-start="827"> </p>
<p data-is-only-node="" data-is-last-node="" data-end="965" data-start="827"><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Founder Bundle III', 'Das ultimative provibe Bundle! Für alle, die provibe nicht nur trinken, sondern auch leben möchten: Dieses Bundle kombiniert unsere beliebtesten Eistee-Sor', null, null, null, null, null, null, null)
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_options (id, product_id, name, position, values) values ('c4ff632d-85de-5e36-ad17-f5f9bef4dfdb', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'Größe', 0, array['S','M','L']::text[]) on conflict (product_id, name) do update set values = excluded.values;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'PV-FB3-S', null, 'S', '{"Größe":"S"}'::jsonb, 0, 5740, null, 'components_sum', 1, 2510, 600, 54159316615495)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 0, false, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'PV-FB3-M', null, 'M', '{"Größe":"M"}'::jsonb, 1, 5740, null, 'components_sum', 1, 2510, 600, 54159316648263)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 0, false, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'PV-FB3-L', null, 'L', '{"Größe":"L"}'::jsonb, 2, 5740, null, 'components_sum', 1, 2510, 600, 54159316681031)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 0, false, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('88fd7551-b3ff-5a5a-a004-dceac49adc36', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'seed/images/Untitled_Project_-_illustrationImage_25.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage_25.jpg', 5454, 3600, '{"de":"Founder Bundle III, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('ea6732b7-c83a-5a8e-a06f-71acb1100d3c', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'seed/images/Element_1_5x_8afa6a5d-b432-4c6e-818e-90b5f16804f0.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Element_1_5x_8afa6a5d-b432-4c6e-818e-90b5f16804f0.png', 1938, 1269, '{"de":"Founder Bundle III, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('4a47ed1c-163c-57d3-a89a-529c0be7b94c', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'seed/images/Element_2_5x_b51581d4-9141-4040-bf0a-944897de40f7.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Element_2_5x_b51581d4-9141-4040-bf0a-944897de40f7.png', 2855, 2855, '{"de":"Founder Bundle III, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('eeb11ac6-69b7-5757-a28a-345d3df86fe6', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 'seed/images/Element_3_5x_20ad42ca-91f3-4317-9630-3682010f11fc.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Element_3_5x_20ad42ca-91f3-4317-9630-3682010f11fc.png', 2855, 2855, '{"de":"Founder Bundle III, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('96b09176-62c7-5c32-a7f8-df9147b545c8', 'founder-bundle-ii', 'draft', 'bundle', 'provibe', 'Bundle', array['bundle','aktion']::text[], false, 0, 'Stück', null, 'piece', 'piece', null, '{}'::jsonb, 10854838763847, 1, '2026-06-16T00:13:00+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('96b09176-62c7-5c32-a7f8-df9147b545c8', 'de', 'Founder Bundle II', null, '<p data-start="0" data-end="49"><strong data-start="0" data-end="49">Das provibe Bundle für echte Geschmacksträger</strong></p>
<p data-start="51" data-end="364">Dieses Bundle vereint alles, wofür provibe steht: außergewöhnlichen Geschmack und einen lässigen Look. Freue dich auf <strong data-start="169" data-end="195">6 erfrischende Eistees</strong> – je <strong data-start="201" data-end="266">2 Dosen unserer Sorten Pfirsich, Wildberry und Raspberry-Lime</strong> – und dazu unser exklusives <strong data-start="295" data-end="340">„Looks Like You Have Great Taste“ T-Shirt</strong> im modernen Unisex-Fit.</p>
<p data-start="366" data-end="545">Ob für dich selbst oder als Geschenk: Mit diesem Bundle bekommst du die volle provibe Experience – fruchtige Erfrischung für den Geschmack und ein Statement für den Style. </p>
<p data-start="547" data-end="561"><strong data-start="547" data-end="561">Enthalten:</strong></p>
<ul data-start="562" data-end="702" data-is-last-node="" data-is-only-node="">
<li data-section-id="w2fts4" data-start="562" data-end="584">2 × provibe Peach</li>
<li data-section-id="1q50oy8" data-start="585" data-end="608">2 × provibe Wildberry</li>
<li data-section-id="1gn9246" data-start="609" data-end="637">2 × provibe Raspberry-Lime</li>
<li data-section-id="tkcgu5" data-start="638" data-end="702" data-is-last-node="">1 × provibe T-Shirt „Looks like you have great taste“ (Unisex)</li>
<li data-section-id="tkcgu5" data-start="638" data-end="702" data-is-last-node="">
</li>
</ul>
<p><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Founder Bundle II', 'Das provibe Bundle für echte Geschmacksträger Dieses Bundle vereint alles, wofür provibe steht: außergewöhnlichen Geschmack und einen lässigen Look. Freue ', null, null, null, null, null, null, null)
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_options (id, product_id, name, position, values) values ('b9441204-7e94-55d1-aa0b-0f5937c81157', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'Größe', 0, array['S','M','L']::text[]) on conflict (product_id, name) do update set values = excluded.values;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('630068d7-dd4f-596b-af83-1fca450ec60e', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'PV-FB2-S', null, 'S', '{"Größe":"S"}'::jsonb, 0, 4580, null, 'components_sum', 1, 2360, 600, 54149793612103)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('630068d7-dd4f-596b-af83-1fca450ec60e', 0, false, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('36c4b0c7-98a7-5a76-a40e-d9050241032a', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'PV-FB2-M', null, 'M', '{"Größe":"M"}'::jsonb, 1, 4580, null, 'components_sum', 1, 2360, 600, 54149793644871)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 0, false, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'PV-FB2-L', null, 'L', '{"Größe":"L"}'::jsonb, 2, 4580, null, 'components_sum', 1, 2360, 600, 54149793677639)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 0, false, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('f456fdec-03de-57b3-ad46-68ef30bc5c31', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'seed/images/UntitledProject-illustrationImage_23.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/UntitledProject-illustrationImage_23.jpg', 5454, 3600, '{"de":"Founder Bundle II, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a04baa20-16b6-536b-ad08-883327eef3b6', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'seed/images/Element_2_5x_26bd035e-269b-48ac-80dc-93dce692632d.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Element_2_5x_26bd035e-269b-48ac-80dc-93dce692632d.png', 2855, 2855, '{"de":"Founder Bundle II, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('534e8b82-53f2-57f8-aab9-5248fa608ade', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'seed/images/Element_1_5x_9f79ee42-5a34-41b0-b7d0-8b4b0e9cd82e.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Element_1_5x_9f79ee42-5a34-41b0-b7d0-8b4b0e9cd82e.png', 2133, 2839, '{"de":"Founder Bundle II, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a3a484e0-3527-54dd-ad02-0719c18a3e33', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'seed/images/Element_4_5x_97243291-58df-4c85-8be7-0c9e8a16fece.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Element_4_5x_97243291-58df-4c85-8be7-0c9e8a16fece.png', 2064, 2587, '{"de":"Founder Bundle II, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('10988966-7664-57b5-aed4-e9d1f3362956', '96b09176-62c7-5c32-a7f8-df9147b545c8', 'seed/images/Element_5_5x_2353abb9-c7b6-44a2-b853-a3772b8ae0c6.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Element_5_5x_2353abb9-c7b6-44a2-b853-a3772b8ae0c6.png', 2064, 2587, '{"de":"Founder Bundle II, Produktbild 5"}'::jsonb, 4) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 'founder-bundle-i', 'draft', 'bundle', 'provibe', 'Bundle', array['bundle','aktion']::text[], false, 0, 'Stück', null, 'piece', 'piece', null, '{}'::jsonb, 10854835224903, 2, '2026-06-16T00:12:09+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 'de', 'Founder Bundle I', null, '<p data-start="0" data-end="36"><strong data-start="0" data-end="36">Das perfekte provibe Starter-Set</strong></p>
<p data-start="38" data-end="203">Enthalten sind jeweils <strong data-start="61" data-end="100">2 Dosen unserer drei provibe Sorten</strong> – <strong data-start="103" data-end="115">Pfirsich</strong>, <strong data-start="117" data-end="130">Wildberry</strong> und <strong data-start="135" data-end="153">Raspberry Lime</strong> – sowie unser exklusiver <strong data-start="179" data-end="202">provibe Trinkbecher</strong>.</p>
<p data-start="205" data-end="459">So kannst du dich durch alle Geschmacksrichtungen probieren und deinen provibe ganz nach deinem Geschmack genießen. Mit ein paar Eiswürfeln im Becher wird daraus im Handumdrehen eine angenehm gekühlte Erfrischung für unterwegs, beim Sport oder im Alltag.</p>
<p data-start="461" data-end="472"><strong data-start="461" data-end="472">Inhalt:</strong></p>
<ul data-start="473" data-end="574">
<li data-section-id="w2fts4" data-start="473" data-end="495">2 × provibe Peach</li>
<li data-section-id="1q50oy8" data-start="496" data-end="519">2 × provibe Wildberry</li>
<li data-section-id="1gmpfy3" data-start="520" data-end="548">2 × provibe Raspberry-Lime</li>
<li data-section-id="cmhhxm" data-start="549" data-end="574">1 × provibe cup</li>
</ul>
<p data-start="576" data-end="686" data-is-last-node="" data-is-only-node="">Der ideale Einstieg in die provibe-Welt – zum Kennenlernen, Verschenken oder einfach selbst Genießen.</p>
<p data-start="576" data-end="686" data-is-last-node="" data-is-only-node=""> </p>
<p data-start="576" data-end="686" data-is-last-node="" data-is-only-node=""><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Founder Bundle I', 'Das perfekte provibe Starter-Set Enthalten sind jeweils 2 Dosen unserer drei provibe Sorten – Pfirsich , Wildberry und Raspberry Lime – sowie unser exklusi', null, null, null, null, null, null, null)
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 'PV-FB1', null, 'Standard', '{}'::jsonb, 0, 3580, null, 'components_sum', 1, 2310, 600, 54149782929735)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', 0, false, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('d5ad031b-a36e-54ce-a1b5-b2f88b947ed1', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 'seed/images/UntitledProject-illustrationImage_22.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/UntitledProject-illustrationImage_22.jpg', 5454, 3600, '{"de":"Founder Bundle I, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('122b53f3-29ea-5e6d-a193-9c9fd93fb4e4', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 'seed/images/Gemini_Generated_Image_oygj7doygj7doygj_17570fd0-169a-4415-8ac0-1d0d90a8c634.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Gemini_Generated_Image_oygj7doygj7doygj_17570fd0-169a-4415-8ac0-1d0d90a8c634.png', 1824, 2294, '{"de":"Founder Bundle I, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('f24689e0-8431-5c83-aef7-b61f507da6e3', 'provibe-eistee-mixed', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854820872519, 3, '2026-06-14T00:06:24+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('f24689e0-8431-5c83-aef7-b61f507da6e3', 'de', 'provibe Eistee mixed', 'Alle drei Sorten in einem Paket', '<p data-start="18" data-end="255">Du kannst dich nicht für eine Sorte entscheiden? Dann ist das <strong data-start="80" data-end="96">Mixed Bundle</strong> genau das Richtige für dich. Es vereint alle provibe Sorten in einem Paket und bietet die perfekte Möglichkeit, die gesamte Geschmacksvielfalt kennenzulernen.</p>
<p data-start="257" data-end="495">Jede Sorte ist zu gleichen Teilen enthalten, sodass du ausgewogen durchprobieren und für jeden Moment den passenden Geschmack finden kannst. Ob fruchtig-spritzig, erfrischend oder beerig – mit dem Mixed Bundle ist für Abwechslung gesorgt.</p>
<p data-start="497" data-end="654">Erhältlich in verschiedenen Paketgrößen und ideal für alle, die ihre Lieblingssorte noch suchen oder einfach die ganze Vielfalt von provibe genießen möchten.</p>
<p data-start="497" data-end="654"> </p>
<p data-start="497" data-end="654"><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'provibe Eistee mixed: Eistee mit 15 g Protein', 'Du kannst dich nicht für eine Sorte entscheiden? Dann ist das Mixed Bundle genau das Richtige für dich. Es vereint alle provibe Sorten in einem Paket und b', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p><strong>Wildberry:</strong> Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 4,4 % schwarzer Johannisbeersaft aus schwarzem Johannisbeersaftkonzentrat, 1,6 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Heidelbeere), Süßungsmittel (Sucralose).</p><p><strong>Raspberry-Lime:</strong> Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3,8 % Himbeersaft aus Himbeersaftkonzentrat, 3,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Süßkartoffel, Rettich und Apfel), Süßungsmittel (Sucralose).</p><p><strong>Peach:</strong> Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3 % Pfirsichsaft aus Pfirsichsaftkonzentrat, 1,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Saflor), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","variants":{"wildberry":{"per":"100 ml","energy_kj":91,"energy_kcal":22,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"},"raspberry-lime":{"per":"100 ml","energy_kj":86,"energy_kcal":20,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"},"peach":{"per":"100 ml","energy_kj":89,"energy_kcal":21,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}}}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_options (id, product_id, name, position, values) values ('4e1fd901-6b34-5b28-a4c8-ef33295066cd', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c215c17c-7375-5083-ac05-1dc0c8f6e940', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-09', null, '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149677154631)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c215c17c-7375-5083-ac05-1dc0c8f6e940', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('146d46ed-7af9-5967-a140-2d9847109fac', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-12', null, '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149677187399)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('146d46ed-7af9-5967-a140-2d9847109fac', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('ce93647c-8df8-54a6-ae0b-3d99f46cbe44', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-18', null, '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149677220167)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('ce93647c-8df8-54a6-ae0b-3d99f46cbe44', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('1d9aeea2-5295-5430-a6de-8e836e06a1ee', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-24', null, '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149677252935)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('1d9aeea2-5295-5430-a6de-8e836e06a1ee', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('67d74f80-357b-59ef-ad98-9e9a9a36daa6', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-36', null, '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149677285703)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('67d74f80-357b-59ef-ad98-9e9a9a36daa6', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('ced977b0-851c-5487-a09e-fa40b65313b4', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'PV-MX-48', null, '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149677318471)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('ced977b0-851c-5487-a09e-fa40b65313b4', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('785e1ddf-8aaa-5dff-ae64-52320281aa08', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/Untitled_Project_-_illustrationImage-20.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-20.png', 4738, 3702, '{"de":"provibe Eistee mixed, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('ec3564e3-c30a-5b69-a61d-022306abc955', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/Untitled_Project_-_illustrationImage-8.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-8.png', 1029, 868, '{"de":"provibe Eistee mixed, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('c58352bd-fafb-5f22-a0a1-dc8202ab5bc5', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 1853, 1405, '{"de":"provibe Eistee mixed, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('6379f363-aeae-53ab-a5db-74861fad01e6', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 'seed/images/Untitled_Project_-_illustrationImage-6.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-6.png', 1517, 1200, '{"de":"provibe Eistee mixed, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'provibe-clear-cup', 'draft', 'simple', 'provibe', 'Merchandise', array['merch']::text[], false, 0, 'Stück', null, 'piece', 'piece', 150, '{}'::jsonb, 10854814155079, 4, '2026-06-14T00:03:07+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'de', 'provibe clear cup', null, null, '3–5 Werktage', 'provibe clear cup', null, null, null, null, null, null, null, null)
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('51ba586a-1988-5cb2-a232-d45e3453adf9', '557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'PV-CUP', null, 'Standard', '{}'::jsonb, 0, 1990, null, 'none', 1, 150, 100, 54149661983047)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('51ba586a-1988-5cb2-a232-d45e3453adf9', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('14ecbef5-428d-5277-a4b6-5d928b69c531', '557af6a1-a3f8-5cb3-adf1-3934fd16337d', 'seed/images/Gemini_Generated_Image_oygj7doygj7doygj.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Gemini_Generated_Image_oygj7doygj7doygj.png', 1824, 2294, '{"de":"provibe clear cup, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('8415a344-72aa-5871-afa5-4b70f754760a', 'provibe-shirt', 'draft', 'simple', 'provibe', 'Merchandise', array['merch']::text[], false, 0, 'Stück', null, 'piece', 'piece', 200, '{}'::jsonb, 10854810485063, 5, '2026-06-14T00:01:26+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('8415a344-72aa-5871-afa5-4b70f754760a', 'de', 'provibe shirt', null, null, '3–5 Werktage', 'provibe shirt', null, null, null, null, null, null, null, null)
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_options (id, product_id, name, position, values) values ('6fb25519-62cd-583c-aa95-e60c585cc949', '8415a344-72aa-5871-afa5-4b70f754760a', 'Größe', 0, array['S','M','L']::text[]) on conflict (product_id, name) do update set values = excluded.values;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', '8415a344-72aa-5871-afa5-4b70f754760a', 'PV-SHIRT-S', null, 'S', '{"Größe":"S"}'::jsonb, 0, 2990, null, 'none', 1, 200, 100, 54149657985351)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c2072d06-de41-5507-a442-997148729c01', '8415a344-72aa-5871-afa5-4b70f754760a', 'PV-SHIRT-M', null, 'M', '{"Größe":"M"}'::jsonb, 1, 2990, null, 'none', 1, 200, 100, 54149658018119)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c2072d06-de41-5507-a442-997148729c01', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', '8415a344-72aa-5871-afa5-4b70f754760a', 'PV-SHIRT-L', null, 'L', '{"Größe":"L"}'::jsonb, 2, 2990, null, 'none', 1, 200, 100, 54149658050887)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a96ed990-d64d-5c16-a1af-40dda084584f', '8415a344-72aa-5871-afa5-4b70f754760a', 'seed/images/Screenshot2026-06-1215.11.55.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Screenshot2026-06-1215.11.55.png', 1838, 665, '{"de":"provibe shirt, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('a80bbf48-a552-5164-a1df-067f05890b9e', 'raspberry-lime', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854789284167, 6, '2026-06-13T23:50:10+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('a80bbf48-a552-5164-a1df-067f05890b9e', 'de', 'Raspberry-Lime Eistee', 'Fruchtig-spritzig mit Limette', '<p data-start="0" data-end="296"><strong data-start="0" data-end="18">Raspberry Lime</strong> vereint die fruchtige Süße sonnengereifter Himbeeren mit der spritzigen Frische von Limetten zu einem harmonischen Geschmackserlebnis. Die perfekt ausbalancierte Kombination aus süß und säuerlich sorgt für einen erfrischenden Genuss, der weder zu schwer noch zu intensiv wirkt.</p>
<p data-start="298" data-end="580">Mit seinem belebenden Frischekick ist Raspberry Lime der ideale Begleiter für warme Sommertage, entspannte Momente mit Freunden oder einfach für alle, die sich eine fruchtig-erfrischende Auszeit gönnen möchten. Jeder Schluck bringt die Leichtigkeit des Sommers direkt zu dir.</p>
<p data-start="298" data-end="580"> </p>
<p data-start="298" data-end="580"><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Raspberry-Lime Eistee: Eistee mit 15 g Protein', 'Raspberry Lime vereint die fruchtige Süße sonnengereifter Himbeeren mit der spritzigen Frische von Limetten zu einem harmonischen Geschmackserlebnis. Die p', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p>Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3,8 % Himbeersaft aus Himbeersaftkonzentrat, 3,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Süßkartoffel, Rettich und Apfel), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","energy_kj":86,"energy_kcal":20,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_options (id, product_id, name, position, values) values ('c7146dfe-25e3-5074-aad3-4d23f0c3d16e', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('587f3e0f-4f96-5605-a597-f3ff89cf8e8d', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-09', null, '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149605359943)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('587f3e0f-4f96-5605-a597-f3ff89cf8e8d', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('a1ee699c-414d-5f2b-a88d-ad840e5e60a5', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-12', null, '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149605392711)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('a1ee699c-414d-5f2b-a88d-ad840e5e60a5', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('130e9fd9-3da1-58da-a177-8f741e18dbe0', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-18', null, '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149605425479)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('130e9fd9-3da1-58da-a177-8f741e18dbe0', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('6f97148c-c6e9-5a15-a198-9dbb3b738794', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-24', null, '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149605458247)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('6f97148c-c6e9-5a15-a198-9dbb3b738794', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('309deb13-a55e-58f1-a1e5-f885c6fdc3e5', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-36', null, '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149605491015)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('309deb13-a55e-58f1-a1e5-f885c6fdc3e5', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('1efba969-103f-5931-ac68-3ac7d83b2cc2', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-48', null, '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149605523783)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('1efba969-103f-5931-ac68-3ac7d83b2cc2', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('f91a117e-0d33-5271-a76b-e46422d25167', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'seed/images/Untitled_Project_-_illustrationImage-8.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-8.png', 1029, 868, '{"de":"Raspberry-Lime Eistee, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('82526963-c264-5381-a82f-3243a974c363', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'seed/images/Untitled_Project_-_illustrationImage_17.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage_17.jpg', 3261, 4032, '{"de":"Raspberry-Lime Eistee, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('7a9e4853-5bf0-53f7-a1c1-974d538a090a', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'seed/images/Untitled_Project_-_illustrationImage-13.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-13.png', 2742, 2742, '{"de":"Raspberry-Lime Eistee, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'peach', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854784467271, 7, '2026-06-13T23:48:07+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'de', 'Peach Eistee', 'Der Klassiker: saftiger Pfirsich', '<p data-start="56" data-end="103"><strong data-start="56" data-end="103">Pfirsich-Eistee – der Klassiker von provibe</strong></p>
<p data-start="105" data-end="507" data-is-last-node="" data-is-only-node="">Unser Pfirsich-Eistee vereint den saftig-süßen Geschmack sonnengereifter Pfirsiche mit der feinen Note von Schwarztee. Das Ergebnis: eine ausgewogene Erfrischung mit vollem Geschmack – fruchtig, aber nicht aufdringlich, angenehm süß, aber nie zu viel. Genau die richtige Balance für alle, die einen ehrlichen, unkomplizierten Eistee genießen möchten. Ein echter Klassiker, der einfach immer passt.</p>
<p data-start="105" data-end="507" data-is-last-node="" data-is-only-node=""> </p>
<p data-start="105" data-end="507" data-is-last-node="" data-is-only-node=""><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Peach Eistee: Eistee mit 15 g Protein', 'Pfirsich-Eistee – der Klassiker von provibe Unser Pfirsich-Eistee vereint den saftig-süßen Geschmack sonnengereifter Pfirsiche mit der feinen Note von Schw', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p>Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 3 % Pfirsichsaft aus Pfirsichsaftkonzentrat, 1,5 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Saflor), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","energy_kj":89,"energy_kcal":21,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_options (id, product_id, name, position, values) values ('a2223650-7498-5aa2-ac7f-514e4cc40ba1', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('2cdd6040-3969-538f-af4c-cf18246fbba1', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-09', 'PEACH', '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149574000967)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('2cdd6040-3969-538f-af4c-cf18246fbba1', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c81c79b6-6980-5a89-a43e-61faa8a16680', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-12', null, '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149574033735)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c81c79b6-6980-5a89-a43e-61faa8a16680', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('8f14f25e-35f7-59c6-a08f-e429cdbfcab0', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-18', null, '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149574066503)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('8f14f25e-35f7-59c6-a08f-e429cdbfcab0', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('2faf0497-c253-58df-a9d5-0457c7f6a8f4', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-24', null, '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149574099271)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('2faf0497-c253-58df-a9d5-0457c7f6a8f4', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('d530fd55-ffb4-57f7-a6cf-1c90586391cc', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-36', null, '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149574132039)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('d530fd55-ffb4-57f7-a6cf-1c90586391cc', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('d0d0795b-bccc-58be-a7af-dea5746f4ce4', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-48', null, '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149574164807)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('d0d0795b-bccc-58be-a7af-dea5746f4ce4', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('94272363-c59a-5bd5-abfb-16e074d28756', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0770_2_6ae60530-5008-4cf3-ac6d-f07e2739bd9a.jpg', 1853, 1405, '{"de":"Peach Eistee, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('d07be6db-929b-5274-af8c-ed3a48a3cec9', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/Untitled_Project_-_illustrationImage_19.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage_19.jpg', 2805, 4027, '{"de":"Peach Eistee, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('41fd87e3-2d69-523f-a456-5579c18e0a8e', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/IMG_0769_2.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0769_2.jpg', 2112, 1600, '{"de":"Peach Eistee, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('26878e37-26e0-5d79-aa17-79316fa6e250', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'seed/images/Untitled_Project_-_illustrationImage-19.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-19.png', 1296, 1296, '{"de":"Peach Eistee, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.products (id, handle, status, kind, vendor, product_type, tags, is_food, deposit_cents_per_unit, unit_label, net_content_per_unit, net_content_measure, base_price_measure, weight_grams_per_unit, attributes, shopify_product_id, position, published_at)
values ('9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'wildberry', 'draft', 'simple', 'provibe', 'Eistee', array['eistee']::text[], true, 25, 'Dose', 0.330, 'l', 'l', 360, '{"lactose_free":true,"protein_g_per_unit":15,"sugar_free":true,"made_in":"DE","ready_to_drink":true}'::jsonb, 10854668861767, 8, '2026-06-13T22:50:08+02:00')
on conflict (handle) do update set shopify_product_id = excluded.shopify_product_id, attributes = excluded.attributes, deposit_cents_per_unit = excluded.deposit_cents_per_unit;
-- @@
insert into public.product_translations (product_id, locale, title, subtitle, description_html, delivery_time_text, seo_title, seo_description, food_name, ingredients_html, allergens, nutrition, storage_instructions, food_business_operator, country_of_origin)
values ('9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'de', 'Wildberry Eistee', 'Beerig, vollmundig, natürlich', '<p data-start="0" data-end="330"><strong data-start="0" data-end="13">Wildberry</strong> vereint die fruchtige Vielfalt ausgewählter Beeren zu einem vollmundigen Geschmackserlebnis, das Erinnerungen an unbeschwerte Kindheitstage weckt. Die harmonische Kombination aus Johannisbeeren, Heidelbeeren und Erdbeeren sorgt für eine ausgewogene Balance zwischen fruchtiger Intensität und angenehmer Leichtigkeit.</p>
<p data-start="332" data-end="549">Das Ergebnis ist ein runder, natürlicher Beerengeschmack, der zu jeder Gelegenheit passt – erfrischend, vertraut und einfach lecker. Ein zeitloser Klassiker für alle, die den authentischen Geschmack von Beeren lieben.</p>
<p data-start="332" data-end="549"> </p>
<p data-start="332" data-end="549"><strong>Pfand bereits im Preis inkl. (0,25€ pro Dose)</strong></p>', '3–5 Werktage', 'Wildberry Eistee: Eistee mit 15 g Protein', 'Wildberry vereint die fruchtige Vielfalt ausgewählter Beeren zu einem vollmundigen Geschmackserlebnis, das Erinnerungen an unbeschwerte Kindheitstage weckt', 'Eistee mit Molkenprotein, mit Süßungsmittel', '<p>Wasser, Beta-Lactoglobulin aus <strong>Kuhmilch</strong> (Molkenprotein), 4,4 % schwarzer Johannisbeersaft aus schwarzem Johannisbeersaftkonzentrat, 1,6 % Limettensaft aus Limettensaftkonzentrat, natürliche Aromen, färbendes Lebensmittel (Konzentrat aus Karotte und Heidelbeere), Süßungsmittel (Sucralose).</p>', 'Milch (Molkenprotein). Laktosefrei.', '{"per":"100 ml","energy_kj":91,"energy_kcal":22,"fat_g":"<0,5","saturated_fat_g":"<0,1","carbs_g":"<0,5","sugar_g":"<0,5","fibre_g":"<0,5","protein_g":"4,5","salt_g":"<0,01"}'::jsonb, null, 'CG Projects UG (haftungsbeschränkt), Kurt-Viermetz-Straße 1a, 86150 Augsburg, Deutschland', 'Deutschland')
on conflict (product_id, locale) do update set title = excluded.title, subtitle = excluded.subtitle, description_html = excluded.description_html, ingredients_html = excluded.ingredients_html, allergens = excluded.allergens, nutrition = excluded.nutrition, food_business_operator = excluded.food_business_operator;
-- @@
insert into public.product_options (id, product_id, name, position, values) values ('514d341f-0d95-52c2-a2af-cf170d37f516', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'Menge', 0, array['9','12','18','24','36','48']::text[]) on conflict (product_id, name) do update set values = excluded.values;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('811c1bbb-1bd4-5b5d-a74b-bd21f2577357', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-09', 'WILDBERRY-1', '9 Dosen', '{"Menge":"9"}'::jsonb, 0, 2610, null, 'none', 9, 3240, 400, 54149500567879)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('811c1bbb-1bd4-5b5d-a74b-bd21f2577357', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('907ce79c-a819-5a39-a127-3c351b8dc9ea', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-12', 'WILDBERRY-2', '12 Dosen', '{"Menge":"12"}'::jsonb, 1, 3460, null, 'none', 12, 4320, 500, 54149500600647)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('907ce79c-a819-5a39-a127-3c351b8dc9ea', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('e8dd15ea-4767-5d31-a28a-34c10bae9867', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-18', 'WILDBERRY-3', '18 Dosen', '{"Menge":"18"}'::jsonb, 2, 5150, null, 'none', 18, 6480, 700, 54149500633415)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('e8dd15ea-4767-5d31-a28a-34c10bae9867', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('c42a18b4-2bf2-5910-a886-7af572c333bc', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-24', 'WILDBERRY-4', '24 Dosen', '{"Menge":"24"}'::jsonb, 3, 6790, null, 'none', 24, 8640, 900, 54149500666183)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('c42a18b4-2bf2-5910-a886-7af572c333bc', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('746f87fe-fb5c-5330-aed7-37a61bfb2ef2', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-36', 'WILDBERRY-5', '36 Dosen', '{"Menge":"36"}'::jsonb, 4, 10090, null, 'none', 36, 12960, 1200, 54149500698951)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('746f87fe-fb5c-5330-aed7-37a61bfb2ef2', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, legacy_sku, title, option_values, position, price_cents, compare_at_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, shopify_variant_id)
values ('f51d7afe-f717-5846-aa5b-feaaac316aa2', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-48', 'WILDBERRY-6', '48 Dosen', '{"Menge":"48"}'::jsonb, 5, 13200, null, 'none', 48, 17280, 1500, 54149500731719)
on conflict (id) do update set price_cents = excluded.price_cents, compare_at_kind = excluded.compare_at_kind, weight_grams = excluded.weight_grams, sku = excluded.sku;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory, allow_backorder) values ('f51d7afe-f717-5846-aa5b-feaaac316aa2', 0, true, false) on conflict (variant_id) do nothing;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('7f28aef4-8a18-5308-a0dd-592532ad7e40', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/Untitled_Project_-_illustrationImage-6.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-6.png', 1517, 1200, '{"de":"Wildberry Eistee, Produktbild 1"}'::jsonb, 0) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a0d44328-9347-5d62-a311-8039f3308f2f', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/Untitled_Project_-_illustrationImage_18.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage_18.jpg', 2655, 3386, '{"de":"Wildberry Eistee, Produktbild 2"}'::jsonb, 1) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('e5f4537c-ee64-536a-a556-0350f7bad4ad', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/IMG_0764_2.jpg', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/IMG_0764_2.jpg', 1869, 1417, '{"de":"Wildberry Eistee, Produktbild 3"}'::jsonb, 2) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_images (id, product_id, storage_path, source_url, width, height, alt, position) values ('a4f854cb-479e-557a-acd0-8839e377fe83', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'seed/images/Untitled_Project_-_illustrationImage-10.png', 'https://cdn.shopify.com/s/files/1/0929/8411/5527/files/Untitled_Project_-_illustrationImage-10.png', 2048, 2048, '{"de":"Wildberry Eistee, Produktbild 4"}'::jsonb, 3) on conflict (id) do update set storage_path = excluded.storage_path, position = excluded.position;
-- @@
insert into public.product_variants (id, product_id, sku, title, option_values, position, price_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, is_active)
values ('e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 'PV-PE-01', '1 Dose (Bundle-Komponente)', '{"Menge":"1"}'::jsonb, 99, 290, 'none', 1, 360, 0, false)
on conflict (id) do nothing;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory) values ('e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 0, true) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, title, option_values, position, price_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, is_active)
values ('c152685b-728e-5426-ae63-974ba7077871', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 'PV-WB-01', '1 Dose (Bundle-Komponente)', '{"Menge":"1"}'::jsonb, 99, 290, 'none', 1, 360, 0, false)
on conflict (id) do nothing;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory) values ('c152685b-728e-5426-ae63-974ba7077871', 0, true) on conflict (variant_id) do nothing;
-- @@
insert into public.product_variants (id, product_id, sku, title, option_values, position, price_cents, compare_at_kind, unit_count, weight_grams, packaging_weight_grams, is_active)
values ('d424f7bb-a1b2-521e-ae5f-bf6659c48557', 'a80bbf48-a552-5164-a1df-067f05890b9e', 'PV-RL-01', '1 Dose (Bundle-Komponente)', '{"Menge":"1"}'::jsonb, 99, 290, 'none', 1, 360, 0, false)
on conflict (id) do nothing;
-- @@
insert into public.inventory_levels (variant_id, on_hand, track_inventory) values ('d424f7bb-a1b2-521e-ae5f-bf6659c48557', 0, true) on conflict (variant_id) do nothing;
-- @@
insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('f139ed5a-dc05-5c05-af8d-fd98f1a54287', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1)
on conflict do nothing;
-- @@
insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('630068d7-dd4f-596b-af83-1fca450ec60e', 'be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', 1)
on conflict do nothing;
-- @@
insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('36c4b0c7-98a7-5a76-a40e-d9050241032a', 'c2072d06-de41-5507-a442-997148729c01', 1)
on conflict do nothing;
-- @@
insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('32bafc2f-b3c2-5cc1-ab20-558a6915669d', 'c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', 1)
on conflict do nothing;
-- @@
insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1),
  ('ee0c9bb0-dc4d-5b1f-a8f3-cb9202f9354e', 'be41b0f5-56f2-5e14-a9ae-e1a76c11cef2', 1)
on conflict do nothing;
-- @@
insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1),
  ('1003e1b3-3ce7-5078-a82d-28700fe54d4d', 'c2072d06-de41-5507-a442-997148729c01', 1)
on conflict do nothing;
-- @@
insert into public.bundle_components (bundle_variant_id, component_variant_id, quantity) values
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'e15c8f6e-e2ea-5ed1-a253-5f35ce47b434', 2),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'c152685b-728e-5426-ae63-974ba7077871', 2),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'd424f7bb-a1b2-521e-ae5f-bf6659c48557', 2),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', '51ba586a-1988-5cb2-a232-d45e3453adf9', 1),
  ('52d21d3a-4db1-5f1e-ab02-5d758c896870', 'c27c0ae8-9186-5414-a2bb-44ac3d0c4bc0', 1)
on conflict do nothing;
-- @@
insert into public.collections (id, handle, kind, status, position) values ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'eistee', 'manual', 'draft', 0) on conflict (handle) do nothing;
-- @@
insert into public.collection_translations (collection_id, locale, title) values ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'de', 'Eistee') on conflict (collection_id, locale) do update set title = excluded.title;
-- @@
insert into public.collection_products (collection_id, product_id, position) values
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 0),
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 1),
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 2),
  ('6a5c119c-96d2-5241-a93a-9d1e285f92b7', 'a80bbf48-a552-5164-a1df-067f05890b9e', 3)
on conflict (collection_id, product_id) do update set position = excluded.position;
-- @@
insert into public.collections (id, handle, kind, status, position) values ('633547b5-44a0-5d96-a757-7f9c721440fd', 'aktion', 'manual', 'draft', 1) on conflict (handle) do nothing;
-- @@
insert into public.collection_translations (collection_id, locale, title) values ('633547b5-44a0-5d96-a757-7f9c721440fd', 'de', 'Founder Bundles') on conflict (collection_id, locale) do update set title = excluded.title;
-- @@
insert into public.collection_products (collection_id, product_id, position) values
  ('633547b5-44a0-5d96-a757-7f9c721440fd', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 0),
  ('633547b5-44a0-5d96-a757-7f9c721440fd', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 1),
  ('633547b5-44a0-5d96-a757-7f9c721440fd', '96b09176-62c7-5c32-a7f8-df9147b545c8', 2)
on conflict (collection_id, product_id) do update set position = excluded.position;
-- @@
insert into public.collections (id, handle, kind, status, position) values ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'alle-produkte', 'manual', 'draft', 2) on conflict (handle) do nothing;
-- @@
insert into public.collection_translations (collection_id, locale, title) values ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'de', 'Produkte') on conflict (collection_id, locale) do update set title = excluded.title;
-- @@
insert into public.collection_products (collection_id, product_id, position) values
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', '9c75b257-7b40-5f5a-a786-cca9b5440fbb', 0),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'dc7c49f3-157a-5e72-a103-cafc74c72c4b', 1),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'a80bbf48-a552-5164-a1df-067f05890b9e', 2),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'f24689e0-8431-5c83-aef7-b61f507da6e3', 3),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', '96b09176-62c7-5c32-a7f8-df9147b545c8', 4),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', '2c86d29b-4af4-56d4-aa75-aec7d6a31db6', 5),
  ('c4b564b2-5dc6-5fa6-a50f-c8e5a1afb897', 'f7794b6a-b2c7-5da6-aeb7-fb38644631fc', 6)
on conflict (collection_id, product_id) do update set position = excluded.position;
-- @@
insert into public.collections (id, handle, kind, rules, status, position) values ('1aea467e-4320-5f94-ac6d-d726b0d9019a', 'all', 'automatic', '[{"field":"status","op":"eq","value":"active"}]', 'draft', 3) on conflict (handle) do nothing;
-- @@
insert into public.collection_translations (collection_id, locale, title) values ('1aea467e-4320-5f94-ac6d-d726b0d9019a', 'de', 'Produkte') on conflict (collection_id, locale) do nothing;
-- @@
insert into public.homepage_modules (id, kind, position, is_enabled, config) values
  ('71d79f3e-04a2-5ceb-a45c-a523e0abdce3', 'hero', 0, true, '{"eyebrow":"Eistee mit Protein","headline":"Protein, das in jede Tasche passt.","text":"Schluss mit Shakern und Pulver. provibe ist erfrischender Eistee mit 15 g Protein – einfach kalt genießen, überall.","badges":["15 g Protein","Ohne Zucker","Eiskalt & erfrischend"],"cta":{"label":"Jetzt entdecken","url":"/collections/all"},"image":"seed/images/Element_9_10x_7c776464-d280-4ff9-9b5c-f78aebf50ba7.png"}'::jsonb),
  ('f3fa5d09-fcc9-51b6-ac59-378dba8b6951', 'bestseller', 1, true, '{"eyebrow":"Unser Bestseller","product_handle":"provibe-eistee-mixed","details_label":"Alle Details ansehen"}'::jsonb),
  ('55beadf3-84de-57de-ad04-06e6177a784c', 'flavors', 2, true, '{"eyebrow":"Unsere Sorten","headline":"Such dir deinen Vibe.","cta":{"label":"Alle ansehen","url":"/collections/all"},"items":[{"product_handle":"peach","notes":"Saftiger Pfirsich","image":"seed/images/provibe-peach.png"},{"product_handle":"wildberry","notes":"Brombeere · Heidelbeere · Erdbeere","image":"seed/images/provibe-wildberry.png"},{"product_handle":"raspberry-lime","notes":"Himbeere · spritzige Limette","image":"seed/images/provibe-raspberry.png"}]}'::jsonb),
  ('8d058ccf-19ba-56d6-af81-5b358fe566f9', 'story', 3, true, '{"eyebrow":"Protein for your purse","headline":"Schluss mit dem pelzigen Proteingefühl.","text":"Keine Lust mehr auf eine 30-€-Riesendose Pulver, die nach Sport schmeckt und null erfrischt? provibe ist der erfrischendste Eistee mit 15 g Protein – ready to drink, klein genug für jede Tasche.","cta":{"label":"Jetzt entdecken","url":"/collections/all"}}'::jsonb),
  ('fca9b973-c067-5200-a07a-035c975f26bb', 'bundles', 4, true, '{"eyebrow":"Founder Bundles","headline":"Alles in einem Set.","collection_handle":"aktion","badge":"Limitiertes Set","cta":{"label":"Alle ansehen","url":"/collections/aktion"}}'::jsonb)
on conflict (id) do update set config = excluded.config, position = excluded.position;
-- @@
insert into public.staff_invites (email, role) values ('hello@provibe-drinks.de', 'owner'), ('mail@paulschoettler.de', 'owner') on conflict (email) do nothing;
-- @@
commit;
