import "server-only";
import { z } from "zod";

/**
 * Serverseitige Umgebungsvariablen, einmal validiert. Fehlende Live-Keys sind erlaubt,
 * solange APP_INTEGRATIONS=mock ist. Nichts hiervon darf in den Client gelangen.
 */
const schema = z.object({
  APP_STAGE: z.enum(["local", "preview", "production"]).default("local"),
  APP_INTEGRATIONS: z.enum(["mock", "live"]).default("mock"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  SITE_PROTECT_USER: z.string().optional(),
  SITE_PROTECT_PASSWORD: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_FROM_TRANSACTIONAL: z.string().default("provibe <bestellung@provibe-drinks.de>"),
  EMAIL_FROM_NEWSLETTER: z.string().default("provibe <newsletter@provibe-drinks.de>"),
  EMAIL_REPLY_TO: z.string().default("hello@provibe-drinks.de"),
  EMAIL_ALLOWLIST: z.string().default("@provibe-drinks.de,mail@paulschoettler.de"),

  LEXWARE_API_KEY: z.string().optional(),
  LEXWARE_INVOICE_MODE: z.enum(["draft", "final"]).default("draft"),

  DHL_API_KEY: z.string().optional(),
  DHL_USERNAME: z.string().optional(),
  DHL_PASSWORD: z.string().optional(),
  DHL_BILLING_NUMBER: z.string().optional(),
  DHL_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),

  META_CAPI_ACCESS_TOKEN: z.string().optional(),
  GA4_API_SECRET: z.string().optional(),
  TIKTOK_EVENTS_ACCESS_TOKEN: z.string().optional(),

  APP_TOKEN_SECRET: z.string().min(32).optional(),
  JOBS_RUNNER_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ungültige Umgebungsvariablen: ${issues}`);
  }
  const env = parsed.data;
  if (env.APP_INTEGRATIONS === "live") {
    const missing = (
      [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "RESEND_API_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ] as const
    ).filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(`APP_INTEGRATIONS=live, aber es fehlen: ${missing.join(", ")}`);
    }
    if (
      env.APP_STAGE !== "production" &&
      env.STRIPE_SECRET_KEY &&
      !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY)
    ) {
      throw new Error("Außerhalb von production sind nur Stripe-Testkeys erlaubt");
    }
  }
  cached = env;
  return env;
}

export { isEmailAllowlisted } from "./allowlist";
