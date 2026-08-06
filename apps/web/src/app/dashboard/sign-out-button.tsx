"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Spinner } from "@spine/ui";
import { authClient } from "../../lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={handleSignOut} disabled={loading}>
      {loading ? <Spinner size="sm" /> : "Sign out"}
    </Button>
  );
}
