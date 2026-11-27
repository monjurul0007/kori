import { cn } from "@/lib/utils";

import { KoriMark } from "./KoriMark";

/** The mark plus "Kori". The Bangla name is marked lang="bn" and hidden from the accessible name. */
export function Wordmark({
  markSize = 30,
  showBangla = true,
  showMark = true,
  className,
  banglaClassName,
}: {
  markSize?: number;
  showBangla?: boolean;
  showMark?: boolean;
  className?: string;
  /** Overrides the Bangla name's colour, for use on the hero panel. */
  banglaClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-display font-bold", className)}>
      {showMark && <KoriMark size={markSize} />}
      <span>Kori</span>
      {showBangla && (
        <span
          lang="bn"
          aria-hidden="true"
          className={cn("text-[0.8em] font-medium text-muted-foreground", banglaClassName)}
        >
          কড়ি
        </span>
      )}
    </span>
  );
}
