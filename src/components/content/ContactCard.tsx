import { InstagramIcon, TiktokIcon } from "@/components/layout/icons";
import type { ShopSettings } from "@/lib/content/settings";
import { InhaltIcon } from "./Decor";

function handleFromUrl(url: string): string {
  const m = url.match(/(?:instagram\.com|tiktok\.com)\/@?([^/?#]+)/i);
  return m ? `@${m[1]}` : url;
}

/** Kontaktkarte "Direkt erreichen" (Figma 26:3148) mit E-Mail, Social-Profilen und Partner-Mail. */
export function ContactCard({ settings }: { settings: ShopSettings }) {
  const { contact, social } = settings;
  return (
    <aside
      className="bg-pink-light flex flex-col gap-[14px] rounded-[10px] px-5 py-6"
      aria-labelledby="direkt-titel"
    >
      <h2 id="direkt-titel" className="text-wine m-0 text-[22px] font-semibold lg:text-[26px]">
        Direkt erreichen
      </h2>
      <div className="pv-channel">
        <span className="pv-icon-circle" aria-hidden="true">
          <InhaltIcon name="mail" />
        </span>
        <span className="min-w-0">
          <span className="pv-channel-label">E-Mail</span>
          <a href={`mailto:${contact.email}`} className="pv-channel-value">
            {contact.email}
          </a>
        </span>
      </div>
      <div className="pv-channel">
        <span className="pv-icon-circle" aria-hidden="true">
          <InstagramIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="pv-channel-label">Instagram</span>
          <a
            href={social.instagram}
            target="_blank"
            rel="noreferrer noopener"
            className="pv-channel-value !no-underline"
          >
            {handleFromUrl(social.instagram)}
          </a>
        </span>
      </div>
      <div className="pv-channel">
        <span className="pv-icon-circle" aria-hidden="true">
          <TiktokIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="pv-channel-label">TikTok</span>
          <a
            href={social.tiktok}
            target="_blank"
            rel="noreferrer noopener"
            className="pv-channel-value !no-underline"
          >
            {handleFromUrl(social.tiktok)}
          </a>
        </span>
      </div>
      <div className="pv-channel">
        <span className="pv-icon-circle" aria-hidden="true">
          <InhaltIcon name="heart" />
        </span>
        <span className="min-w-0">
          <span className="pv-channel-label">Für Partneranfragen</span>
          <a href={`mailto:${contact.partnerEmail}`} className="pv-channel-value">
            {contact.partnerEmail}
          </a>
        </span>
      </div>
      <p className="m-0 text-[14px] leading-[1.5]">
        Wir antworten werktags innerhalb von 24 Stunden.
      </p>
    </aside>
  );
}

export default ContactCard;
