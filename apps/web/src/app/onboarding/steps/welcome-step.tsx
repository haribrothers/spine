"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spine/ui";

export interface WelcomeStepProps {
  onStartManual: () => void;
  onUseDemoDefaults: () => void;
  onSkip: () => void;
}

/**
 * Wizard-entry screen, before step 1: set up the business, explore a demo
 * business ("Just show me around" opens the country and industry picker,
 * US-ONB-18) or go straight to the dashboard.
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
