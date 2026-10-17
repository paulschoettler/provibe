"use client";

import { useState, type ReactNode } from "react";
import { useActionFormState } from "@/components/admin/ui/ActionForm";

/**
 * React setzt Formulare nach jeder Server Action zurück. Eingaben, die ActionForm über values
 * zurückgibt, kommen bei Textfeldern über defaultValue wieder an, bei <select> und kontrollierten
 * Feldern aber nicht. Nach einem Fehler hängen wir die Felder deshalb neu ein: defaultValue greift
 * wieder, kontrollierte Felder zeigen ihren Zustand. Nur innerhalb von ActionForm verwenden.
 */
export function RemountOnError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const state = useActionFormState();
  const [seen, setSeen] = useState(state);
  const [version, setVersion] = useState(0);
  // Zustand während des Renderns anpassen (kein Effekt): neue Fehlerantwort → neu einhängen
  if (state !== seen) {
    setSeen(state);
    if (state.status === "error") setVersion((v) => v + 1);
  }
  return (
    <div key={version} className={className}>
      {children}
    </div>
  );
}
