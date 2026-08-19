import { Separator as RadixSeparator } from "radix-ui";
import { cx } from "./cn";

/**
 * Radix, so `decorative` is a DECISION at the call site rather than an
 * accident. A hand-rolled `h-px bg-line` is either always announced to a
 * screen reader or never announced — and both are wrong somewhere: the rule
 * between two register sections is structure worth announcing, the hairline
 * inside a button group is not.
 */
export function Separator({
  orientation = "horizontal", decorative = true, className,
}: {
  orientation?: "horizontal" | "vertical" | undefined;
  decorative?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <RadixSeparator.Root
      orientation={orientation}
      decorative={decorative}
      className={cx(
        "shrink-0 bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
