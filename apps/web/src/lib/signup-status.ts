"use client";

import { useEffect, useState } from "react";
import { apiClient } from "./api-client";

export interface SignupStatus {
  open: boolean;
  businessName: string | null;
}

/** US-AUTH-08 — whether this instance still accepts a first account; null while loading. */
export function useSignupStatus(): SignupStatus | null {
  const [status, setStatus] = useState<SignupStatus | null>(null);
  useEffect(() => {
    apiClient
      .get<SignupStatus>("/public/signup-status")
      .then(setStatus)
      // Unknown isn't "closed": show the form and let the server decide
      // (it refuses a sign-up without an invitation with its own message).
      .catch(() => setStatus({ open: true, businessName: null }));
  }, []);
  return status;
}
