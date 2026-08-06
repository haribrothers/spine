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

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account. Please try again.");
      return;
    }

    // Land a brand-new org straight into the onboarding wizard, not the
    // dashboard — the wizard itself is always skippable from its first
    // screen, so this doesn't gate anything, it's just the natural first
    // stop after creating a fresh organisation.
    router.push("/onboarding");
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
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Sets up a new organisation with you as the owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField label="Name" required>
              {(field) => (
                <Input
                  {...field}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
            </FormField>

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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              )}
            </FormField>

            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? <Spinner size="sm" /> : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px] text-on-surface-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
