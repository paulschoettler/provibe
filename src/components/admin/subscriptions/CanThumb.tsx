import Image from "next/image";

/** Dosenbild der Sorte auf zartem Grund (Figma Abo-Liste, 28 × 40 px). */
const BACKGROUND: Record<string, string> = {
  wildberry: "bg-[#f7dceb]",
  "raspberry-lime": "bg-[#e6f2d9]",
  peach: "bg-[#f7ca99]",
};

export function CanThumb({ src, size = "sm" }: { src: string | null; size?: "sm" | "md" }) {
  const handle = src?.match(/cans\/([a-z-]+)\./)?.[1] ?? "";
  const box = size === "md" ? "h-12 w-9" : "h-10 w-7";
  return (
    <span
      aria-hidden="true"
      className={`${box} ${BACKGROUND[handle] ?? "bg-admin-flaeche"} flex shrink-0 items-center justify-center overflow-hidden rounded-[6px]`}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={size === "md" ? 24 : 19}
          height={size === "md" ? 44 : 36}
          className="h-[90%] w-auto object-contain"
        />
      ) : null}
    </span>
  );
}
