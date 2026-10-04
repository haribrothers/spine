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
      .catch(() => setStatus({ open: false, businessName: null }));
  }, []);
  return status;
}
