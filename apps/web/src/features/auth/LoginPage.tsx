import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { KoriMark } from "@/components/brand/KoriMark";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { usePageTitle } from "@/lib/usePageTitle";

import { useLogin } from "./hooks";
import { useSession } from "./session";
import { loginErrorMessage, safeNext } from "./utils";

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;
const TAGLINE = "Every taka, accounted for.";
const FORGOT_PASSWORD_HELP =
  "Kori doesn't send reset emails. Ask whoever runs your Kori server to reset your password.";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .max(MAX_EMAIL_LENGTH, "Email is too long")
    .refine((value) => value.length > MAX_EMAIL_LENGTH || z.email().safeParse(value).success, {
      message: "That doesn't look like an email address",
    }),
  password: z
    .string()
    .min(1, "Enter your password")
    .max(MAX_PASSWORD_LENGTH, "Password is too long"),
});
type Values = z.infer<typeof schema>;

function BrandPanel() {
  return (
    <div className="grid content-end gap-2.5 bg-hero px-[22px] pb-7 pt-14 text-hero-foreground md:content-center md:gap-[18px] md:p-12">
      <KoriMark size={64} />
      <Wordmark
        showMark={false}
        className="items-baseline gap-3 text-4xl leading-none md:text-[56px]"
        banglaClassName="text-xl text-accent md:text-[30px]"
      />
      <p className="text-hero-muted md:text-[17px]">{TAGLINE}</p>
    </div>
  );
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const session = useSession();
  const login = useLogin();
  usePageTitle("Log in");
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    setFocus("email");
  }, [setFocus]);

  if (session.user) return <Navigate to={next} replace />;

  const onSubmit = (values: Values) =>
    login.mutate(values, { onSuccess: () => navigate(next, { replace: true }) });

  return (
    <main className="grid min-h-dvh grid-rows-[auto_1fr] bg-background md:grid-cols-2 md:grid-rows-1">
      <BrandPanel />
      <div className="flex px-[22px] py-6 md:items-center md:px-16 md:py-12">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="mx-auto flex w-full max-w-sm flex-col gap-3.5"
        >
          <h1 className="sr-only font-display text-2xl font-semibold md:not-sr-only">Log in</h1>
          {login.error && (
            <p role="alert" className="text-sm text-over">
              {loginErrorMessage(login.error)}
            </p>
          )}
          <Field label="Email" error={errors.email?.message}>
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="username"
                className="h-11"
                {...register("email")}
              />
            )}
          </Field>
          <Field label="Password" error={errors.password?.message}>
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  type={isPasswordShown ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-11 pr-12"
                  {...register("password")}
                />
                <IconButton
                  aria-label="Show password"
                  aria-pressed={isPasswordShown}
                  onClick={() => setIsPasswordShown((isShown) => !isShown)}
                  className="absolute right-0 top-0 h-11 w-11"
                >
                  {isPasswordShown ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </IconButton>
              </div>
            )}
          </Field>
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="-my-1 min-h-11 self-end rounded-md px-1 text-sm font-medium text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            Forgot password?
          </button>
          <Button type="submit" className="h-11" disabled={login.isPending}>
            {login.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {login.isPending ? "Logging in…" : "Log in"}
          </Button>
          <p className="hidden text-xs text-muted-foreground md:block">
            Kori keeps you logged in on this device for 30 days.
          </p>
        </form>
      </div>
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forgot password?</DialogTitle>
            <DialogDescription>{FORGOT_PASSWORD_HELP}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </main>
  );
}
