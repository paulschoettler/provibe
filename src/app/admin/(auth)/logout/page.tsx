import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/admin/staff/actions";
import { supabaseServer } from "@/lib/supabase/server";
import { AuthCard } from "@/components/admin/auth/AuthCard";
import { SubmitButton } from "@/components/admin/ui/SubmitButton";
import { ButtonLink } from "@/components/admin/ui/Button";

export const metadata: Metadata = { title: "Abmelden" };

/**
 * /admin/logout: Abmelden per Formular (POST), nicht per GET, damit ein Vorab-Laden des Links
 * niemanden abmeldet. Die Seitenleiste meldet direkt über dieselbe Server Action ab.
 */
export default async function AdminLogoutPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return (
    <AuthCard
      symbol="abmelden"
      title="Abmelden?"
      subtitle="Du meldest dich in diesem Browser vom Backoffice ab."
    >
      <form action={logoutAction} className="flex flex-col gap-3">
        <SubmitButton block pendingLabel="Wird abgemeldet …">
          Abmelden
        </SubmitButton>
        <ButtonLink href="/admin" block>
          Zurück zum Backoffice
        </ButtonLink>
      </form>
    </AuthCard>
  );
}
