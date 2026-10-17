import type { Metadata, Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMfaContext } from "@/lib/admin/staff/mfa";
import { adminLoginUrl, safeAdminNext } from "@/lib/admin/staff/redirect";
import { AuthCard } from "@/components/admin/auth/AuthCard";
import { EnrollmentFlow, RecoveryForm, VerifyForm } from "@/components/admin/auth/TwoFactorForms";

export const metadata: Metadata = { title: "Zwei-Faktor-Bestätigung" };

/**
 * /admin/2fa (Figma 27:4478): Code-Eingabe; beim ersten Login Einrichtung mit QR-Code und
 * Wiederherstellungscodes; ?modus=wiederherstellung für den Notfall (H15).
 */
export default async function AdminTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; modus?: string }>;
}) {
  const params = await searchParams;
  const next = safeAdminNext(params.next);
  const ctx = await getMfaContext();
  if (!ctx) redirect(adminLoginUrl(next) as Route);
  // Direkt nach der Einrichtung bleibt die Seite stehen, bis die Wiederherstellungscodes gesichert sind
  const justEnrolled = (await cookies()).get("pv_admin_mfa_neu")?.value === "1";
  if ((ctx.aal === "aal2" && !justEnrolled) || !ctx.staff.mfa_enforced) redirect(next as Route);

  if (!ctx.verifiedFactorId || (justEnrolled && ctx.aal === "aal2")) {
    return (
      <AuthCard
        symbol="schild"
        title="Zwei-Faktor einrichten"
        subtitle="Für das Backoffice brauchst du einen zweiten Faktor. Das dauert eine Minute und ist nur einmal nötig."
      >
        <EnrollmentFlow next={next} />
      </AuthCard>
    );
  }

  if (params.modus === "wiederherstellung") {
    return (
      <AuthCard
        symbol="schild"
        title="Wiederherstellungscode"
        subtitle="Gib einen der Codes ein, die du beim Einrichten gespeichert hast."
      >
        <RecoveryForm next={next} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      symbol="schild"
      title="Zwei-Faktor-Bestätigung"
      subtitle="Gib den sechsstelligen Code aus deiner Authenticator-App ein."
    >
      <VerifyForm next={next} />
    </AuthCard>
  );
}
