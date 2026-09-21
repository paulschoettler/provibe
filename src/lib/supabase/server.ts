import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env/public";
import type { Database } from "./database.types";

/** Supabase-Client für Server Components und Route Handler mit Nutzer-Session (RLS greift). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // In Server Components ist das Setzen von Cookies nicht erlaubt; die Proxy-Schicht übernimmt das.
        }
      },
    },
  });
}

/** Anonymer Client für öffentliche Katalogdaten (statische Generierung, keine Cookies). */
export function supabaseAnon() {
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
