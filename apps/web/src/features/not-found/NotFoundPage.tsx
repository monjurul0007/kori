import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";

/** Shown for any URL that doesn't match a route; rendered inside the app shell. */
export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p className="mb-4 text-sm text-muted-foreground">
        That address doesn&apos;t match a page in Kori.
      </p>
      <Link to="/dashboard" className={buttonVariants()}>
        Go to dashboard
      </Link>
    </>
  );
}
