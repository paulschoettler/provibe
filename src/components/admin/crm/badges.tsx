import { Badge, type BadgeTone } from "@/components/admin/ui/Badge";
import {
  ACCOUNT_STATUS_LABEL,
  NEWSLETTER_STATUS_LABEL,
  type AccountStatus,
} from "@/lib/admin/customers/profile";
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/admin/leads/status";

/** Status-Badges des CRM (Farbe nie allein, immer mit Text). */

type NewsletterStatus = keyof typeof NEWSLETTER_STATUS_LABEL;

const NEWSLETTER_TONE: Record<NewsletterStatus, { tone: BadgeTone; hollow?: boolean }> = {
  subscribed: { tone: "green" },
  pending: { tone: "yellow", hollow: true },
  unsubscribed: { tone: "gray" },
  bounced: { tone: "red" },
  complained: { tone: "red" },
  none: { tone: "gray", hollow: true },
};

export function NewsletterBadge({ status }: { status: string }) {
  const key = (status in NEWSLETTER_TONE ? status : "none") as NewsletterStatus;
  const t = NEWSLETTER_TONE[key];
  return (
    <Badge tone={t.tone} hollow={t.hollow}>
      {NEWSLETTER_STATUS_LABEL[key]}
    </Badge>
  );
}

const ACCOUNT_TONE: Record<AccountStatus, BadgeTone> = {
  active: "green",
  not_activated: "gray",
  blocked: "red",
  anonymized: "gray",
};

export function AccountBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge tone={ACCOUNT_TONE[status]} hollow={status === "not_activated"}>
      Konto {ACCOUNT_STATUS_LABEL[status]}
    </Badge>
  );
}

export const LEAD_TONE: Record<LeadStatus, BadgeTone> = {
  new: "accent",
  contacted: "blue",
  qualified: "yellow",
  won: "green",
  lost: "gray",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_TONE[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
}

const CAMPAIGN_TONE: Record<string, { tone: BadgeTone; hollow?: boolean }> = {
  draft: { tone: "gray" },
  scheduled: { tone: "blue", hollow: true },
  sending: { tone: "yellow" },
  sent: { tone: "green" },
  cancelled: { tone: "gray", hollow: true },
  failed: { tone: "red" },
};

export function CampaignStatusBadge({ status, label }: { status: string; label: string }) {
  const t = CAMPAIGN_TONE[status] ?? { tone: "gray" as BadgeTone };
  return (
    <Badge tone={t.tone} hollow={t.hollow}>
      {label}
    </Badge>
  );
}

const EMAIL_TONE: Record<string, { tone: BadgeTone; hollow?: boolean }> = {
  queued: { tone: "gray", hollow: true },
  sent: { tone: "blue" },
  delivered: { tone: "green" },
  bounced: { tone: "red" },
  complained: { tone: "red" },
  failed: { tone: "red" },
  suppressed: { tone: "yellow" },
  blocked_allowlist: { tone: "yellow", hollow: true },
};

export function EmailStatusBadge({ status, label }: { status: string; label: string }) {
  const t = EMAIL_TONE[status] ?? { tone: "gray" as BadgeTone };
  return (
    <Badge tone={t.tone} hollow={t.hollow}>
      {label}
    </Badge>
  );
}

/** Tag-Chip in der Optik der Figma-Liste (grauer Kasten, ohne Punkt). */
export function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-admin-rahmen bg-admin-flaeche inline-flex h-[24px] items-center rounded-[6px] border px-2 text-[12px] font-medium whitespace-nowrap">
      {children}
    </span>
  );
}
