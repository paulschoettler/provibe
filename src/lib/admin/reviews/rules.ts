/**
 * Regeln der Bewertungsmoderation (rein, getestet in rules.test.ts).
 *
 * UWG und Omnibus-Richtlinie (§ 5b Abs. 3 UWG): Wer Bewertungen zugänglich macht, darf sie nicht
 * nach Sternen auswählen. Freigabe deshalb nie nach Sternen filtern, negative Bewertungen nur bei
 * einem Verstoß gegen die Regeln ablehnen. Der Grund ist Pflicht und wird protokolliert.
 */

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

/** Tabs in der Oberfläche (URL-Parameter) */
export const REVIEW_TABS: { key: string; status: ReviewStatus; label: string }[] = [
  { key: "offen", status: "pending", label: "Offen" },
  { key: "freigegeben", status: "approved", label: "Freigegeben" },
  { key: "abgelehnt", status: "rejected", label: "Abgelehnt" },
];

export function statusFromTab(tab: string | undefined): ReviewStatus {
  return REVIEW_TABS.find((t) => t.key === tab)?.status ?? "pending";
}

/** Zulässige Ablehnungsgründe: nur Regelverstöße, nie "schlechte Bewertung". */
export const REJECTION_REASONS = [
  { value: "beleidigung", label: "Beleidigung, Hassrede oder Diskriminierung" },
  { value: "personendaten", label: "Personenbezogene Daten Dritter" },
  { value: "werbung", label: "Werbung, Spam oder Links" },
  { value: "kein_bezug", label: "Kein Bezug zum Produkt (zum Beispiel nur Versand oder Paket)" },
  { value: "unecht", label: "Zweifel an der Echtheit (kein Kauf nachweisbar)" },
  { value: "rechtswidrig", label: "Rechtswidriger Inhalt" },
  { value: "sonstiges", label: "Sonstiger Verstoß gegen die Bewertungsregeln" },
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number]["value"];

export function rejectionLabel(value: string | null | undefined): string {
  if (!value) return "";
  const [code, ...rest] = value.split(": ");
  const label = REJECTION_REASONS.find((r) => r.value === code)?.label;
  return label ? [label, rest.join(": ")].filter(Boolean).join(": ") : value;
}

/** Grund als gespeicherter Text "code: Details"; Details sind bei "sonstiges" Pflicht. */
export function buildRejectionReason(
  code: string,
  detail: string,
): { ok: true; value: string } | { ok: false; field: "reason" | "detail"; message: string } {
  const known = REJECTION_REASONS.some((r) => r.value === code);
  if (!known) return { ok: false, field: "reason", message: "Bitte wähle den Regelverstoß aus." };
  const d = detail.trim().slice(0, 500);
  if (code === "sonstiges" && d.length < 10)
    return {
      ok: false,
      field: "detail",
      message: "Bitte beschreib den Verstoß kurz (mindestens 10 Zeichen).",
    };
  return { ok: true, value: d ? `${code}: ${d}` : code };
}

export function excerpt(text: string | null | undefined, max = 120): string {
  const t = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()} …`;
}

export function stars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(r) + "☆".repeat(5 - r);
}
