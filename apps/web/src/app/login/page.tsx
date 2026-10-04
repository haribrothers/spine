"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Spinner,
} from "@spine/ui";
import { authClient } from "../../lib/auth-client";
import { ThemeToggle } from "../../components/theme-toggle";
import { useSignupStatus } from "../../lib/signup-status";

export default function LoginPage() {
  return (
    // useSearchParams (for the accept-invite "next" redirect) requires a
    // Suspense boundary — Next.js bails out the whole route's static
    // prerender otherwise. Everything else here has no reason to suspend,
    // so the fallback only shows for the instant it takes to read the URL.
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const signupStatus = useSignupStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by accept-invite when an invited person without a session needs to
  // log in first (Better Auth's acceptInvitation/getInvitation both require
  // an authenticated session matching the invited email) — send them back
  // to finish accepting instead of the default /dashboard landing.
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message ?? "Invalid email or password.");
      return;
    }

    router.push(next && next.startsWith("/") ? next : "/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm items-center justify-center">
        <Image
          src="/spine-logo-horizontal.png"
          alt="Spine"
          width={140}
          height={41}
          priority
          className="dark:hidden"
        />
        <Image
          src="/spine-logo-horizontal-light.png"
          alt="Spine"
          width={140}
          height={41}
          priority
          className="hidden dark:block"
        />
      </div>
      <ThemeToggle />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back to Spine.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField label="Email" required>
              {(field) => (
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              )}
            </FormField>

            <FormField label="Password" required>
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}
            </FormField>

            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? <Spinner size="sm" /> : "Log in"}
            </Button>
          </form>

          {/* US-AUTH-08: only while the instance has no accounts yet. */}
          {signupStatus?.open && (
            <p className="mt-4 text-center text-[13px] text-on-surface-muted">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
