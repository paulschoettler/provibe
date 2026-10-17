import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/admin/auth";
import { adminTwoFactorUrl, safeAdminNext } from "@/lib/admin/staff/redirect";
import { AuthCard } from "@/components/admin/auth/AuthCard";
import { LoginForm } from "@/components/admin/auth/LoginForm";
import { FormMessage } from "@/components/admin/ui/ActionForm";

export const metadata: Metadata = { title: "Anmelden" };

const NOTICES: Record<string, { tone: "error" | "success" | "info"; text: string }> = {
  link: {
    tone: "error",
    text: "Der Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.",
  },
  zugang: {
    tone: "error",
    text: "Mit diesem Konto ist keine Anmeldung im Backoffice möglich. Wende dich an einen Owner, wenn du Zugang brauchst.",
  },
  abgemeldet: { tone: "success", text: "Du bist abgemeldet." },
  "neu-einrichten": {
    tone: "info",
    text: "Wiederherstellungscode angenommen. Melde dich neu an und richte die Zwei-Faktor-Anmeldung mit deinem neuen Gerät ein.",
  },
};

/** /admin/login (Figma 27:4372, Fehler 27:4419). Wer schon angemeldet ist, landet direkt am Ziel. */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; fehler?: string; abgemeldet?: string; hinweis?: string }>;
}) {
  const params = await searchParams;
  const next = safeAdminNext(params.next);
  const session = await getStaffSession();
  if (session) {
    if (session.mfaEnforced && !session.mfaVerified) redirect(adminTwoFactorUrl(next) as Route);
    redirect(next as Route);
  }
  const key = params.fehler ?? (params.abgemeldet ? "abgemeldet" : params.hinweis);
  const notice = key ? NOTICES[key] : undefined;

  return (
    <AuthCard
      title="Im Backoffice anmelden"
      subtitle="Nur für das PROVIBE-Team. Die Anmeldung ist durch Zwei-Faktor-Authentifizierung geschützt."
    >
      {notice ? (
        <FormMessage tone={notice.tone} className="mb-0">
          {notice.text}
        </FormMessage>
      ) : null}
      <LoginForm next={next === "/admin" ? undefined : next} />
    </AuthCard>
  );
}
