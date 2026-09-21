/**
 * Bis zum Go-live: Nur Empfänger auf der Allowlist bekommen echte Mails. Kein Import von
 * server-only, damit die Logik testbar bleibt; genutzt wird sie ausschließlich serverseitig.
 */
export interface AllowlistEnv {
  APP_STAGE: "local" | "preview" | "production";
  APP_INTEGRATIONS: "mock" | "live";
  EMAIL_ALLOWLIST: string;
}

export function isEmailAllowlisted(email: string, env: AllowlistEnv): boolean {
  const normalized = email.trim().toLowerCase();
  return env.EMAIL_ALLOWLIST.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) =>
      entry === "*"
        ? env.APP_STAGE === "production" && env.APP_INTEGRATIONS === "live"
        : entry.startsWith("@")
          ? normalized.endsWith(entry)
          : normalized === entry,
    );
}
