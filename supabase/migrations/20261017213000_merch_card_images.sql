-- Merch-Produktbilder für die Katalogkarten (Feedback 17.10.2026):
-- Becher auf 4:3 mit eigenem Hintergrund aufgefüllt (vorher Hochformat, in der Karte oben und
-- unten beschnitten), Shirt als linke Bildhälfte (Vorder- und Rückseite am Modell) statt des
-- vierteiligen Screenshots. Die Dateien liegen im Bucket product-media unter seed/images/.
-- Idempotent: läuft auch auf einer Datenbank ohne diese Produkte durch.

update public.product_images pi
set storage_path = 'seed/images/provibe-clear-cup-karte.jpg', width = 3241, height = 2431
from public.products p
where pi.product_id = p.id and p.handle = 'provibe-clear-cup' and pi.position = 0
  and pi.storage_path = 'seed/images/Gemini_Generated_Image_oygj7doygj7doygj.png';

-- Shirt: Original bleibt als zweites Bild in der Galerie erhalten
update public.product_images pi
set position = pi.position + 1
from public.products p
where pi.product_id = p.id and p.handle = 'provibe-shirt'
  and not exists (
    select 1 from public.product_images x
    where x.product_id = p.id and x.storage_path = 'seed/images/provibe-shirt-karte.jpg'
  );

insert into public.product_images (product_id, storage_path, width, height, alt, position)
select p.id, 'seed/images/provibe-shirt-karte.jpg', 960, 665,
       '{"de":"provibe shirt, Vorder- und Rückseite"}'::jsonb, 0
from public.products p
where p.handle = 'provibe-shirt'
  and not exists (
    select 1 from public.product_images x
    where x.product_id = p.id and x.storage_path = 'seed/images/provibe-shirt-karte.jpg'
  );
