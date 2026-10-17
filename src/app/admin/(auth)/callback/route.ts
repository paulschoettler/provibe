import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/admin/audit";
import { getStaffByUserId, toStaffSession } from "@/lib/admin/staff/db";
import { adminTwoFactorUrl, safeAdminNext } from "@/lib/admin/staff/redirect";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Rücksprung aus Magic Link und Einladung des Backoffice (?token_hash=…&type=magiclink|invite).
 * Prüft den Einmal-Token, lässt nur aktive Staff-Benutzer durch und leitet zur Zwei-Faktor-Seite.
 * Getrennt von /auth/callback der Kundenkonten, damit für Staff kein Kundenkonto entsteht.
 */
export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["magiclink", "invite"];

function go(request: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, request.nextUrl.origin), { status: 303 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeAdminNext(params.get("next"));
  if (!tokenHash || !type || !TYPES.includes(type) || params.get("error")) {
    return go(request, "/admin/login?fehler=link");
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    console.warn("[admin] verifyOtp fehlgeschlagen", error?.code);
    return go(request, "/admin/login?fehler=link");
  }

  const staff = await getStaffByUserId(data.user.id);
  if (!staff || !staff.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return go(request, "/admin/login?fehler=zugang");
  }
  await writeAudit(toStaffSession(staff), {
    action: "staff.sign_in",
    entityType: "staff_user",
    entityId: staff.user_id,
    after: { method: type === "invite" ? "invite" : "magic_link" },
  });
  return go(request, adminTwoFactorUrl(next));
}
