import { ButtonLink } from "@/components/admin/ui/Button";
import { EmptyState } from "@/components/admin/ui/EmptyState";

/** Anzeige, wenn die Rolle eine Seite nicht sehen darf (statt einer Fehlerseite). */
export function NoAccess({
  text = "Diese Seite ist für deine Rolle nicht freigegeben. Wende dich an einen Owner, wenn du Zugriff brauchst.",
}: {
  text?: string;
}) {
  return (
    <div className="rounded-admin-karte border-admin-rahmen bg-admin-karte border">
      <EmptyState
        icon="schloss"
        title="Kein Zugriff"
        action={<ButtonLink href="/admin">Zum Dashboard</ButtonLink>}
      >
        {text}
      </EmptyState>
    </div>
  );
}

/** Platzhalter für Module, die Welle 2 baut */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-admin-karte border-admin-rahmen bg-admin-karte border">
      <EmptyState icon="info" title={`${title}: Folgt in Welle 2`}>
        {description}
      </EmptyState>
    </div>
  );
}
