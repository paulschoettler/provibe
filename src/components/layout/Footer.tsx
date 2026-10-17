import Image from "next/image";
import { SiteLink } from "./SiteLink";
import type { MenuItem } from "@/lib/catalog/home";
import { NewsletterForm } from "./NewsletterForm";
import { WaveDivider } from "./WaveDivider";
import { InstagramIcon, TiktokIcon } from "@/components/brand/BrandIcon";
import { FOOTER_QUICK_FALLBACK, PAYMENT_METHODS, SOCIAL_LINKS } from "./social";

export interface FooterProps {
  quickLinks?: MenuItem[];
}

/**
 * Footer in Wine mit flacher Welle oben (Wellen-Stelle 5), Quick-Links, Newsletter
 * mit Double Opt-in, Social-Profilen und Zahlarten. Alles im Server-HTML,
 * nur das Anmeldeformular hat einen Client-Teil für die Rückmeldung.
 */
export function Footer({ quickLinks }: FooterProps) {
  const links = quickLinks && quickLinks.length > 0 ? quickLinks : FOOTER_QUICK_FALLBACK;
  const year = 2026;

  return (
    <footer className="pv-footer">
      <WaveDivider shape="soft" fill="var(--pv-wildberry)" position="top" />

      <div className="pv-footer-inner">
        <div className="pv-footer-grid">
          <div className="pv-footer-brand">
            <Image
              src="/brand/logo/provibe-logo-cream.svg"
              alt="provibe"
              width={202}
              height={79}
              className="pv-footer-logo"
            />
            <p className="pv-footer-claim">Powered by Protein</p>
            <div className="pv-footer-social">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="pv-social pv-social--cream"
                  aria-label={`provibe auf ${social.label}`}
                >
                  {social.label === "Instagram" ? (
                    <InstagramIcon className="h-4 w-4" />
                  ) : (
                    <TiktokIcon className="h-4 w-4" />
                  )}
                </a>
              ))}
            </div>
          </div>

          <nav className="pv-footer-links" aria-label="Rechtliches und Service">
            <h2 className="pv-footer-heading">Quick-Links</h2>
            <ul>
              {links.map((item) => (
                <li key={`${item.label}-${item.url}`}>
                  <SiteLink href={item.url} className="pv-footer-link">
                    {item.label}
                  </SiteLink>
                </li>
              ))}
              {links.some((l) => l.url === "/abo-kuendigen") ? null : (
                <li>
                  <SiteLink href="/abo-kuendigen" className="pv-footer-link">
                    Vertrag kündigen
                  </SiteLink>
                </li>
              )}
            </ul>
          </nav>

          <div className="pv-footer-newsletter">
            <h2 className="pv-footer-heading pv-footer-heading--lg">Zum Newsletter.</h2>
            <p className="pv-footer-text">Versprochen ohne Spam.</p>
            <NewsletterForm />
          </div>
        </div>

        <div className="pv-footer-pay">
          <h2 className="pv-footer-heading">Zahlarten</h2>
          {/* Offizielle Zeichen, unverändert auf weißen Plättchen (docs/zahlarten-logos.md) */}
          <ul className="pv-pay-list pv-pay-logos">
            {PAYMENT_METHODS.map((method) => (
              <li
                key={method.label}
                className={method.wordmark ? "pv-pay-plate pv-pay-plate--wordmark" : "pv-pay-plate"}
              >
                <Image
                  src={method.src}
                  alt={method.label}
                  width={Math.round((method.width / method.height) * 24)}
                  height={24}
                  unoptimized
                  className="pv-pay-logo"
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="pv-footer-bottom">
          <p>
            © {year} provibe
            <a href="/cookie-einstellungen" data-consent-open="" className="pv-consent-footer-link">
              Cookie-Einstellungen
            </a>
          </p>
          <p className="pv-footer-bottom-links">
            <SiteLink href="/pages/impressum" className="pv-footer-inline-link">
              Impressum
            </SiteLink>
            <span aria-hidden="true"> · </span>
            <SiteLink href="/pages/datenschutzerklarung" className="pv-footer-inline-link">
              Datenschutz
            </SiteLink>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
