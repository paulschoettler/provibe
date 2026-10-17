import "server-only";
import { readSummaryCookie } from "@/lib/forms/common";

/** Cookie mit der Zusammenfassung der Kündigung ohne Login (httpOnly, Pfad /abo-kuendigen, 10 Minuten). */
export const CANCEL_COOKIE = "pv_abo_cancel";

export async function readCancellationSummary(): Promise<Record<string, string> | null> {
  return readSummaryCookie(CANCEL_COOKIE);
}
