import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useLogin } from "./hooks";
import { useSession } from "./session";
import { loginErrorMessage, safeNext } from "./utils";

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").max(320),
  password: z.string().min(1, "Enter your password").max(1024),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const session = useSession();
  const login = useLogin();
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
          <CardTitle>Kori · কড়ি</CardTitle>
          <CardDescription>Log in to your expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {login.error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
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
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-600 dark:text-red-400">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="h-11" disabled={login.isPending}>
              {login.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {login.isPending ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
