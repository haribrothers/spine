"use client";

import { Checkbox } from "@spine/ui";

export interface TeamOption {
  id: string;
  name: string;
  isDefault: boolean;
  memberCount: number;
}

/** US-TEAM-20, US-TEAM-21 — every Team with a tick for those chosen and how many people are on it. */
export function TeamChecklist({ teams, value, onChange, label, showCounts = true }: { teams: TeamOption[]; value: string[]; onChange: (ids: string[]) => void; label: string; showCounts?: boolean }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col overflow-hidden rounded-lg border border-border">
      {teams.map((team) => {
        const id = `team-${team.id}`;
        const checked = value.includes(team.id);
        return (
          <label key={team.id} htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-border px-3 py-2 text-[13.5px] text-on-surface first:border-t-0 hover:bg-surface-sunken">
            <Checkbox id={id} checked={checked} onCheckedChange={(on) => onChange(on === true ? [...value, team.id] : value.filter((v) => v !== team.id))} />
            <span className="flex-1">{team.name}</span>
            {showCounts && <span className="text-[12.5px] text-on-surface-muted">{team.memberCount === 1 ? "1 person" : `${team.memberCount} people`}</span>}
          </label>
        );
      })}
    </div>
  );
}
