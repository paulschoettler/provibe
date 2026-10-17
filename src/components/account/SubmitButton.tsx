"use client";

import { useFormStatus } from "react-dom";

/** Absende-Button mit Ladezustand. Ohne JavaScript ein normaler Submit. */
export function SubmitButton({
  children,
  pendingLabel = "Einen Moment …",
  className = "btn-primary w-full",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-disabled={pending}
      name={name}
      value={value}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export default SubmitButton;
