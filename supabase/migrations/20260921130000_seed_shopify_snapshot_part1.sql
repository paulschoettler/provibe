-- Seed aus dem Shopify-Snapshot vom 21.09.2026. Generiert von scripts/seed/generate-seed-sql.ts, nicht von Hand ändern.
-- Idempotent (feste UUIDs, ON CONFLICT). Bilder zeigen auf Pfade im Bucket product-media unter seed/...
-- Teil 1 von 6

insert into public.tax_rates (id, country_code, tax_class, rate_bp, name) values
  ('f16d3f9a-fe73-5b91-a7cc-0b0c6216ce33', 'DE', 'standard', 1900, 'Deutschland 19 %'),
  ('9716ee1c-004e-5296-a48a-941c3750c440', 'DE', 'reduced', 700, 'Deutschland 7 %'),
  ('6fe4d9d5-77f0-5a7f-ae68-03efe2372c0c', 'AT', 'standard', 2000, 'Österreich 20 %'),
  ('11d1f221-927b-5804-ac7f-3942ddacca6f', 'AT', 'reduced', 1000, 'Österreich 10 %')
on conflict (country_code, tax_class, valid_from) do update set rate_bp = excluded.rate_bp, name = excluded.name;

insert into public.shipping_zones (id, code, name, country_codes, is_enabled, position) values
  ('75d8774f-1239-5e83-ad3d-484803f9dcc8', 'de', 'Deutschland', array['DE']::char(2)[], true, 0),
  ('df3a6d27-6887-52eb-a489-4f998b35b037', 'at', 'Österreich', array['AT']::char(2)[], false, 1)
on conflict (code) do update set name = excluded.name, country_codes = excluded.country_codes;

insert into public.shipping_rates (id, zone_id, name, description, price_cents, free_above_subtotal_cents, delivery_time_text, position) values
  ('54b1d33a-425a-5489-acd9-4a9300d1e844', '75d8774f-1239-5e83-ad3d-484803f9dcc8', 'DHL Paket', 'Versand innerhalb Deutschlands', 490, 5000, '3–5 Werktage', 0),
  ('7f1e3ab0-5a0d-5e53-ad14-c523bd37954e', 'df3a6d27-6887-52eb-a489-4f998b35b037', 'DHL Paket International', 'Versand nach Österreich (vorbereitet, abgeschaltet)', 990, 8000, '4–7 Werktage', 0)
on conflict (id) do update set price_cents = excluded.price_cents, free_above_subtotal_cents = excluded.free_above_subtotal_cents, delivery_time_text = excluded.delivery_time_text;

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

insert into public.announcement_messages (id, message, position) values
  ('21dffa88-130b-587f-a56a-fd6139f54d12', 'Versandkostenfrei ab 50 €', 0),
  ('d0e0cb8a-ffc6-50dd-a3ba-4f8456d6dc74', '10% Rabatt auf deine Bestellung mit dem Code PRESALE10', 1)
on conflict (id) do update set message = excluded.message;

insert into public.menus (id, handle, name) values ('62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 'main', 'Hauptnavigation') on conflict (handle) do nothing;

insert into public.menu_items (id, menu_id, position, label, url) values
  ('822184d0-c40f-562f-aa8c-7fdb1dcbacc3', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 0, '{"de":"Shop"}'::jsonb, '/pages/shop'),
  ('003edace-ceeb-54ec-a9ca-96e7c1d994a2', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 1, '{"de":"Über uns"}'::jsonb, '/pages/uber-uns'),
  ('b21e8267-4744-506c-a178-d7147c53ba4b', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 2, '{"de":"Partner"}'::jsonb, '/pages/partner'),
  ('dc5b1d10-e22e-54ac-a71e-57aea56e81a3', '62f97723-96ec-56e1-a4e7-4a09d9c0e8fb', 3, '{"de":"Kontakt"}'::jsonb, '/pages/contact')
on conflict (id) do update set label = excluded.label, url = excluded.url, position = excluded.position;

insert into public.menus (id, handle, name) values ('169e0dca-49ff-594b-a07e-e99c6f74905d', 'footer-quick', 'Footer Quick-Links') on conflict (handle) do nothing;

insert into public.menu_items (id, menu_id, position, label, url) values
  ('b3b073de-af9e-59e0-a7dc-beb0824aed79', '169e0dca-49ff-594b-a07e-e99c6f74905d', 0, '{"de":"Impressum"}'::jsonb, '/pages/impressum'),
  ('c6befc7c-c80f-5b25-a747-10215713739a', '169e0dca-49ff-594b-a07e-e99c6f74905d', 1, '{"de":"Datenschutzerklärung"}'::jsonb, '/policies/privacy-policy'),
  ('7dfccc29-2d40-5626-a80d-4750a2f394fb', '169e0dca-49ff-594b-a07e-e99c6f74905d', 2, '{"de":"AGB"}'::jsonb, '/pages/allgemeine-geschaftsbedingungen'),
  ('908de3e2-456d-5a8f-a15e-f65725bc6718', '169e0dca-49ff-594b-a07e-e99c6f74905d', 3, '{"de":"Widerruf"}'::jsonb, '/pages/ruckgabe-und-wiederrufsbelehrung'),
  ('951e67d6-9c1e-55f4-a3f5-aa186b26d3c9', '169e0dca-49ff-594b-a07e-e99c6f74905d', 4, '{"de":"Versand"}'::jsonb, '/pages/versand'),
  ('4571b045-fd7a-5547-ab19-376b6d19cbeb', '169e0dca-49ff-594b-a07e-e99c6f74905d', 5, '{"de":"Vertrag widerrufen"}'::jsonb, '/pages/widerruf-formular')
on conflict (id) do update set label = excluded.label, url = excluded.url, position = excluded.position;

insert into public.discount_codes (id, code, title, kind, value, is_active) values
  ('caddaa38-8c28-5f32-ab7f-001b7bee795c', 'PRESALE10', '10 % Pre-Sale-Rabatt', 'percentage', 1000, true)
on conflict (code) do nothing;

insert into public.automations (key, name, is_enabled, config) values
  ('welcome', 'Willkommensmail nach Opt-in', false, '{"delay_minutes":5}'),
  ('abandoned_cart', 'Warenkorbabbrecher-Mail', false, '{"delay_hours":24,"requires_marketing_consent":true}'),
  ('review_request', 'Bewertungsanfrage nach Zustellung', false, '{"delay_days":7}')
on conflict (key) do nothing;

insert into public.legal_documents (id, kind, path) values ('8e2cbc6b-b94a-57a9-a010-9524764d484e', 'impressum', '/pages/impressum') on conflict (kind) do nothing;

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

insert into public.legal_documents (id, kind, path) values ('f150d258-c115-500d-afdf-bf8a0185d360', 'agb', '/pages/allgemeine-geschaftsbedingungen') on conflict (kind) do nothing;

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

insert into public.legal_documents (id, kind, path) values ('465b5015-0da0-555e-aa9e-c9394bd880bf', 'widerruf', '/pages/ruckgabe-und-wiederrufsbelehrung') on conflict (kind) do nothing;

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

insert into public.legal_documents (id, kind, path) values ('3d254eb5-d189-5a55-acd0-1e3acf75915e', 'datenschutz', '/policies/privacy-policy') on conflict (kind) do nothing;
