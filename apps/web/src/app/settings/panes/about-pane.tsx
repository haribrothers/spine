"use client";

import { useEffect, useState } from "react";
import { Badge, Spinner } from "@spine/ui";
import { BETA_NOTE, isPrerelease } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { AccountCard, AccountPaneHeader } from "./account-card";

/**
 * US-OPS-52 (D-265) — Settings › Your account › About Spine: the version this
 * server runs, with a "Beta" label on a pre-release, so a tester can say which
 * one they found something in. Everyone sees it.
 */
export function AboutPane() {
  const [version, setVersion] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    apiClient
      .get<{ version?: string }>("/health")
      .then((res) => setVersion(res.version ?? null))
      .catch(() => setVersion(null));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <AccountPaneHeader title="About Spine" description="Which version of Spine this business runs." />
      <AccountCard title="Version">
        {version === undefined ? (
          <Spinner />
        ) : version === null ? (
          <p className="text-[13.5px] text-on-surface-muted">Spine couldn&rsquo;t say which version it is. Try again in a moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-[14px] text-on-surface" data-testid="spine-version">
              Spine {version}
              {isPrerelease(version) && <Badge>Beta</Badge>}
            </p>
            {isPrerelease(version) && <p className="text-[13px] text-on-surface-muted">{BETA_NOTE}</p>}
          </div>
        )}
      </AccountCard>
    </div>
  );
}
