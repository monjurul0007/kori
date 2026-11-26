import { Loader2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks";
import { toastError } from "@/lib/toast";

export function LogoutButton() {
  const navigate = useNavigate();
  const logout = useLogout();
  return (
    <Button
      variant="outline"
      className="h-11 w-full border-over/40 font-semibold text-over hover:bg-over/10 md:w-auto"
      disabled={logout.isPending}
      onClick={() =>
        logout.mutate(undefined, {
          onSuccess: () => navigate("/login", { replace: true }),
          onError: toastError,
        })
      }
    >
      {logout.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden="true" />
      )}
      Log out
    </Button>
  );
}
