import { cn } from "@/lib/utils";

import { KoriMark } from "./KoriMark";

/** The mark plus "Kori". The Bangla name is marked lang="bn" and hidden from the accessible name. */
export function Wordmark({
  markSize = 30,
  showBangla = true,
  className,
}: {
  markSize?: number;
  showBangla?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-display font-bold", className)}>
      <KoriMark size={markSize} />
      <span>Kori</span>
      {showBangla && (
        <span
          lang="bn"
          aria-hidden="true"
          className="text-[0.8em] font-medium text-muted-foreground"
        >
          কড়ি
        </span>
      )}
    </span>
  );
}
