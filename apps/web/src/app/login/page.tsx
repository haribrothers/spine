"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function LoginPage() {
  const router = useRouter();
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

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
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

          <p className="mt-4 text-center text-[13px] text-on-surface-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
