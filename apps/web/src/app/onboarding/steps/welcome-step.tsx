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
 * "Load demo data" seeds ~12-15 sample contacts, catalogue items, and 5
 * sample quotes (spanning draft/sent/an S-03.8 revision, one deliberately
 * left unapproved above the discount-approval threshold) via `POST
 * /demo-data/seed` (apps/api/src/modules/demo-data), tagged `isDemo: true`
 * so Settings can remove them later without touching real records, then
 * skips the manual wizard steps the same way "Skip to dashboard" does.
 * Jobs/Invoices/Payments aren't seeded yet — those modules don't exist yet
 * (see CHANGELOG); this is the natural place to extend once they do.
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
