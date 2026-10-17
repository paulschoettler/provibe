import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Wiederherstellungscodes für die Zwei-Faktor-Anmeldung (Entscheidung H15).
 *
 * - 10 Codes je Einrichtung, Format XXXXX-XXXXX aus 31 gut lesbaren Zeichen (ohne 0/O, 1/I/L):
 *   rund 49 Bit je Code, gegen Durchprobieren zusätzlich Rate Limit.
 * - Gespeichert wird nur scrypt$<salt>$<hash> (je Code eigenes Salz), nie der Klartext.
 *   Kein serverseitiges Geheimnis nötig, deshalb überleben die Codes einen Schlüsselwechsel.
 * - Eingabe ist tolerant: Groß- und Kleinschreibung, Leerzeichen und Bindestriche egal.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const RECOVERY_CODE_COUNT = 10;
const GROUP = 5;

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

/** scrypt-Parameter: N=2^14 hält die Prüfung von 10 Codes unter etwa einer halben Sekunde. */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 32;

export function generateRecoveryCode(): string {
  let raw = "";
  for (let i = 0; i < GROUP * 2; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, GROUP)}-${raw.slice(GROUP)}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

/** Eingabe vereinheitlichen; null, wenn sie nicht wie ein Code aussieht. */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[\s-]/g, "");
  if (cleaned.length !== GROUP * 2) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) throw new Error("Ungültiger Wiederherstellungscode");
  const salt = randomBytes(16);
  const hash = await scrypt(normalized, salt, KEYLEN, PARAMS);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyRecoveryCode(input: string, stored: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input);
  if (!normalized) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(
    normalized,
    Buffer.from(saltB64, "base64url"),
    expected.length,
    PARAMS,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Passenden, noch offenen Code finden. Gibt die id des Treffers zurück (oder null).
 * Prüft alle Kandidaten, damit die Laufzeit nicht verrät, an welcher Stelle der Treffer lag.
 */
export async function findMatchingRecoveryCode(
  input: string,
  candidates: { id: string; code_hash: string }[],
): Promise<string | null> {
  if (!normalizeRecoveryCode(input)) return null;
  let match: string | null = null;
  for (const c of candidates) {
    if ((await verifyRecoveryCode(input, c.code_hash)) && match === null) match = c.id;
  }
  return match;
}
