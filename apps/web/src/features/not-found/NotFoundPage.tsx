import { Link, useLocation, useNavigate } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";
import { usePageTitle } from "@/lib/usePageTitle";
import { cn } from "@/lib/utils";

const FIRST_ENTRY_KEY = "default";

/** Shown for any URL that doesn't match a route; rendered inside the app shell. */
export function NotFoundPage() {
  usePageTitle("Page not found");
  const navigate = useNavigate();
  const { key } = useLocation();
  // A visitor who landed here directly has no earlier page to go back to.
  const goBack = () => (key === FIRST_ENTRY_KEY ? navigate("/dashboard") : navigate(-1));
  return (
    <section className="grid min-h-[60dvh] content-center justify-items-start gap-3">
      <p
        aria-hidden="true"
        className="font-display text-6xl font-bold leading-none text-accent [font-stretch:122%]"
      >
        404
      </p>
      <h1
        tabIndex={-1}
        className="font-display text-[22px] font-semibold focus:outline-none md:text-3xl"
      >
        This page doesn&apos;t exist
      </h1>
      <p className="text-muted-foreground">The link may be old or mistyped. Your data is safe.</p>
      <Link
        to="/dashboard"
        className={cn(buttonVariants(), "mt-1 h-11 rounded-[11px] px-5 font-semibold")}
      >
        Go to dashboard
      </Link>
      <button
        type="button"
        onClick={goBack}
        className="min-h-11 rounded-[10px] px-1 text-sm font-medium text-brand-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        Go back
      </button>
    </section>
  );
}
