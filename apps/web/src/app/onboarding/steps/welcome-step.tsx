"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spine/ui";

export interface WelcomeStepProps {
  onStartManual: () => void;
  onUseDemoDefaults: () => void;
  onSkip: () => void;
}

/**
 * Wizard-entry screen, before step 1 — offers demo data as an alternative
 * to manual setup (S-12.8/PRD F12 "MUST offer to load demo/sample data").
 *
 * Scope decision (documented per task brief): apps/api/src/db/seed today
 * only seeds the chart of accounts — there are no contacts/catalog/quotes
 * schema tables anywhere in the codebase yet to seed sample records into
 * (contacts/catalog/quotes modules are still empty stubs). Building a real
 * demo-data corpus would mean inventing those tables outside this task's
 * scope. So "load demo data" here means: skip the manual wizard steps and
 * rely on the system defaults already seeded at signup (CoA, no numbering
 * overrides, generic template) — enough for an evaluator to reach the
 * dashboard and look around in under a minute, which is the acceptance
 * intent, without fabricating a fake sample-data subsystem. Once
 * contacts/catalog exist, this is the natural place to seed a few real
 * sample records instead.
 */
export function WelcomeStep({ onStartManual, onUseDemoDefaults, onSkip }: WelcomeStepProps) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Welcome to Spine</CardTitle>
        <CardDescription>
          Let&apos;s set a few things up — or jump straight in and configure them later from Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button onClick={onStartManual}>Set up my business</Button>
        <Button variant="secondary" onClick={onUseDemoDefaults}>
          Just show me around (use defaults)
        </Button>
        <Button variant="ghost" onClick={onSkip}>
          Skip to dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
