import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@goproceed/ui/components";

export function MockAction({
  children,
  variant = "signal",
  className = "",
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      disabled
      aria-disabled="true"
      className={`disabled:opacity-100 ${className}`}
    >
      {children}
    </Button>
  );
}
