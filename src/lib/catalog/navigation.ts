import { cache } from "react";
import { supabaseAnon } from "@/lib/supabase/server";
import type { MenuItem } from "./home";

export interface Navigation {
  main: MenuItem[];
  footerQuick: MenuItem[];
  announcements: string[];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Navigation, Footer-Links und Announcement-Meldungen für alle Seiten außer der Startseite
 * (die lädt sie in getHomeData mit). Pro Request einmal geladen (React cache), Daten öffentlich (RLS).
 */
export const getNavigation = cache(async (locale = "de"): Promise<Navigation> => {
  const db = supabaseAnon();
  const [menus, menuItems, announcements] = await Promise.all([
    db.from("menus").select("id, handle"),
    db.from("menu_items").select("*").order("position"),
    db.from("announcement_messages").select("message").eq("is_active", true).order("position"),
  ]);
  const menuId = (handle: string) => (menus.data ?? []).find((m) => m.handle === handle)?.id;
  const items = (handle: string): MenuItem[] =>
    (menuItems.data ?? [])
      .filter((i) => i.menu_id === menuId(handle))
      .map((i) => ({
        label: String(asRecord(i.label)[locale] ?? ""),
        url: i.url,
        external: i.is_external,
      }));
  return {
    main: items("main"),
    footerQuick: items("footer-quick"),
    announcements: (announcements.data ?? []).map((a) => a.message),
  };
});
