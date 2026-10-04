import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks";
import { useSession } from "@/features/auth/session";
import { toastError } from "@/lib/toast";

export function SettingsPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const logout = useLogout();

  return (
    <>
      <PageHeader title="Settings" />
      <section aria-labelledby="profile-heading" className="mb-6">
        <h2 id="profile-heading" className="mb-2 font-medium">
          Profile
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user?.display_name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user?.email}</dd>
          <dt className="text-muted-foreground">Time zone</dt>
          <dd>{user?.timezone}</dd>
          <dt className="text-muted-foreground">Currency</dt>
          <dd>{user?.currency}</dd>
        </dl>
      </section>
      <Button
        variant="outline"
        className="h-11"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSuccess: () => navigate("/login", { replace: true }),
            onError: toastError,
          })
        }
      >
        {logout.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Log out
      </Button>
    </>
  );
}
