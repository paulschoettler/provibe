import type { OrderStep } from "@/lib/auth/order-status";
import { CheckIcon } from "./icons";

const STATE_TEXT: Record<OrderStep["state"], string> = {
  done: "erledigt",
  current: "aktueller Schritt",
  open: "offen",
};

/**
 * Status-Stepper (Figma 26:1258): vier Schritte mit Linie, erledigt mit Haken, aktuell mit Ring.
 * Als geordnete Liste, der Zustand jedes Schritts steht zusätzlich als Text für Screenreader.
 */
export function StatusStepper({
  steps,
  className = "",
}: {
  steps: OrderStep[];
  className?: string;
}) {
  const currentIndex = steps.findIndex((s) => s.state === "current");
  const reached = currentIndex === -1 ? steps.length - 1 : currentIndex;
  return (
    <ol className={`flex items-start ${className}`} aria-label="Bestellstatus">
      {steps.map((step, i) => {
        const leftOn = i > 0 && i <= reached;
        const rightOn = i < steps.length - 1 && i < reached;
        return (
          <li
            key={step.key}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <div className="flex w-full items-center">
              <span
                className={`h-[3px] flex-1 ${i === 0 ? "" : leftOn ? "bg-magenta" : "bg-mauve/40"}`}
                aria-hidden="true"
              />
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                  step.state === "done"
                    ? "bg-magenta border-magenta text-white"
                    : step.state === "current"
                      ? "border-magenta bg-white"
                      : "bg-cream-2 border-mauve/60"
                }`}
                aria-hidden="true"
              >
                {step.state === "done" ? <CheckIcon className="size-4" /> : null}
                {step.state === "current" ? (
                  <span className="bg-magenta size-2.5 rounded-full" />
                ) : null}
              </span>
              <span
                className={`h-[3px] flex-1 ${i === steps.length - 1 ? "" : rightOn ? "bg-magenta" : "bg-mauve/40"}`}
                aria-hidden="true"
              />
            </div>
            <span
              className={`text-center text-[13px] leading-[1.4] ${step.state === "open" ? "font-normal" : "font-semibold"}`}
            >
              {step.label}
              <span className="sr-only">, {STATE_TEXT[step.state]}</span>
            </span>
            <span className="text-center text-[12px] leading-[1.4]">{step.dateText ?? " "}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default StatusStepper;
