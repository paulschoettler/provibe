import "server-only";
import { cache } from "react";
import { supabaseAnon } from "@/lib/supabase/server";
import { EMPTY_TRACKING_CONFIG, resolveTrackingConfig, type PublicTrackingConfig } from "./config";

/**
 * Tracking-IDs serverseitig aus shop_settings (Schlüssel "tracking", is_public, RLS public_read).
 * In den Client gehen nur die IDs der eingeschalteten Dienste (PublicTrackingConfig).
 * Läuft mit dem anonymen Client ohne Cookies, damit Layout und Seiten statisch bleiben; nach einer
 * Änderung im Backoffice braucht es revalidatePath("/", "layout") (docs/tracking.md).
 */
export const getTrackingConfig = cache(async (): Promise<PublicTrackingConfig> => {
  const env = {
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    NEXT_PUBLIC_GOOGLE_TAG_ID: process.env.NEXT_PUBLIC_GOOGLE_TAG_ID,
    NEXT_PUBLIC_TIKTOK_PIXEL_ID: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  };
  try {
    const { data, error } = await supabaseAnon()
      .from("shop_settings")
      .select("value")
      .eq("key", "tracking")
      .maybeSingle();
    if (error) throw error;
    return resolveTrackingConfig(data?.value ?? null, env);
  } catch (error) {
    console.error("[tracking] shop_settings nicht ladbar, Tracking bleibt aus", error);
    return EMPTY_TRACKING_CONFIG;
  }
});
