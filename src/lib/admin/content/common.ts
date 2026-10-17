import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import {
  CONTENT_TAG,
  LEGAL_TAG,
  revalidateBlog,
  revalidateContentPage,
  revalidateLegal,
} from "@/lib/content/revalidate";

/**
 * Gemeinsame Bausteine der Inhalte-Module: Link-Validierung und On-Demand-Revalidation
 * (revalidateTag "content"/"legal", revalidatePath der betroffenen Seiten).
 */

export const linkSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\//i.test(v) || /^mailto:/i.test(v),
    "Link muss mit /, https:// oder mailto: beginnen.",
  );

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Bitte gib einen URL-Namen ein.")
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche.");

export function safeRevalidate(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    // Außerhalb eines Requests (Skripte, Tests) gibt es keinen Cache zum Leeren
    console.warn("[content] Revalidation übersprungen", e instanceof Error ? e.message : e);
  }
}

export function revalidatePage(handle: string): void {
  safeRevalidate(() => revalidateContentPage(handle));
}

export function revalidateLegalKind(kind: Parameters<typeof revalidateLegal>[0]): void {
  safeRevalidate(() => revalidateLegal(kind));
}

export function revalidateBlogPost(handle?: string): void {
  safeRevalidate(() => revalidateBlog(handle));
}

/** Startseite (Module). */
export function revalidateHome(): void {
  safeRevalidate(() => {
    revalidateTag(CONTENT_TAG, "max");
    revalidatePath("/");
  });
}

/** Alles, was im Layout steckt (Announcement-Bar, Navigation, Footer, öffentliche Einstellungen). */
export function revalidateLayout(): void {
  safeRevalidate(() => {
    revalidateTag(CONTENT_TAG, "max");
    revalidateTag(LEGAL_TAG, "max");
    revalidatePath("/", "layout");
  });
}
