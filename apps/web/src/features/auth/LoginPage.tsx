import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useLogin } from "./hooks";
import { useSession } from "./session";
import { loginErrorMessage, safeNext } from "./utils";

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

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

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const session = useSession();
  const login = useLogin();
  const [isPasswordShown, setIsPasswordShown] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  if (session.user) return <Navigate to={next} replace />;

  const onSubmit = (values: Values) =>
    login.mutate(values, { onSuccess: () => navigate(next, { replace: true }) });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <Wordmark markSize={36} className="text-2xl" />
          </CardTitle>
          <CardDescription>Log in to your expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {login.error && (
              <p role="alert" className="text-sm text-over">
                {loginErrorMessage(login.error)}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-over">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={isPasswordShown ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-12"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                />
                <button
                  type="button"
                  aria-label="Show password"
                  aria-pressed={isPasswordShown}
                  onClick={() => setIsPasswordShown((isShown) => !isShown)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground focus-visible:outline focus-visible:outline-2"
                >
                  {isPasswordShown ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-sm text-over">
                  {errors.password.message}
                </p>
              )}
            </div>
            <Button type="submit" className="h-11" disabled={login.isPending}>
              {login.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {login.isPending ? "Logging in…" : "Log in"}
            </Button>
          </form>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer py-2 text-muted-foreground">
              Forgot password?
            </summary>
            <p className="pt-1">
              Kori doesn&apos;t send reset emails. Ask whoever runs your Kori server to reset your
              password.
            </p>
          </details>
        </CardContent>
      </Card>
    </main>
  );
}
