import Image from "next/image";

/**
 * Drei Sortendosen nebeneinander (Mixed-Karte, Kollektionskarte "Alle Produkte", Hero der
 * Shop-Übersicht). Links Raspberry Lime, rechts Peach, vorne Wildberry, wie im Figma-Entwurf.
 * Die Größe steuert der Container über die CSS-Variable --trio-h (Höhe der mittleren Dose).
 */
export function CanTrio({
  className = "",
  sizes = "120px",
  preload = false,
  alt = "",
}: {
  className?: string;
  sizes?: string;
  preload?: boolean;
  /** Leer lassen, wenn der umgebende Text die Dosen schon beschreibt */
  alt?: string;
}) {
  return (
    <div
      className={`pvc-trio ${className}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <Image
        src="/images/cans/raspberry-lime.webp"
        alt=""
        width={405}
        height={760}
        sizes={sizes}
        preload={preload}
        className="pvc-trio__can pvc-trio__can--left"
      />
      <Image
        src="/images/cans/peach.webp"
        alt=""
        width={405}
        height={760}
        sizes={sizes}
        preload={preload}
        className="pvc-trio__can pvc-trio__can--right"
      />
      <Image
        src="/images/cans/wildberry.webp"
        alt=""
        width={750}
        height={1400}
        sizes={sizes}
        preload={preload}
        className="pvc-trio__can pvc-trio__can--center"
      />
    </div>
  );
}

export default CanTrio;
