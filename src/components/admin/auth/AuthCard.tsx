import Image from "next/image";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/admin/ui/Icon";

/**
 * Anmeldekarte nach Figma (27:4373 / 27:4479): Logo, optionales Symbol, Titel 24 px,
 * Untertitel, Inhalt, Sicherheitshinweis unten. Innenabstand 32 px (mobil 24 px), Abstand 20 px.
 */
export function AuthCard({
  title,
  subtitle,
  symbol,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  symbol?: IconName;
  children: ReactNode;
}) {
  return (
    <section className="rounded-admin-karte border-admin-rahmen bg-admin-karte flex flex-col gap-5 border p-6 md:p-8">
      <Image
        src="/images/brand/logo-wine.png"
        alt="provibe"
        width={1000}
        height={297}
        className="h-10 w-auto self-start"
        priority
      />
      {symbol ? (
        <span className="bg-admin-akzent-hell text-admin-akzent flex size-12 items-center justify-center rounded-full">
          <Icon name={symbol} size={24} />
        </span>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[24px] leading-[1.4] font-semibold">{title}</h1>
        {subtitle ? <p className="text-admin-text-2 text-[14px]">{subtitle}</p> : null}
      </div>
      {children}
      <p className="text-admin-text-2 flex items-center justify-center gap-1.5 text-center text-[12px]">
        <Icon name="schloss" size={14} />
        Geschützter Bereich. Jede Anmeldung wird protokolliert.
      </p>
    </section>
  );
}

/** Trenner "oder" (Figma 27:4402) */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="bg-admin-rahmen h-px flex-1" />
      <span className="text-admin-text-2 text-[13px]">oder</span>
      <span className="bg-admin-rahmen h-px flex-1" />
    </div>
  );
}
