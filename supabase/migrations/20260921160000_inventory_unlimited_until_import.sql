-- Bestandsführung erst ab dem Import der Shopify-Exporte (Antwort C5: "davor unbegrenzt").
-- Rückweg: update public.inventory_levels set track_inventory = true;
update public.inventory_levels set track_inventory = false where track_inventory = true;
