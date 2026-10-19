import { useCachedQuery } from "./use-cached-query";

export interface ModuleSwitches {
  leadsMeetings: boolean;
  jobsField: boolean;
  approvals: boolean;
  recurring: boolean;
  /** The AI assistant (US-AI-01): present, and true, only while it's on — never assumed until the server says so. */
  ai?: boolean;
}

const ALL_ON: ModuleSwitches = { leadsMeetings: true, jobsField: true, approvals: true, recurring: true };

/**
 * Which modules are on (`GET /org/modules`, any member). Jobs & field off
 * hides the Jobs tab, job cards and job figures (D-198); Leads & meetings
 * off hides the next meeting. Until the first answer everything is on.
 */
export function useModules(): ModuleSwitches {
  const { data } = useCachedQuery<ModuleSwitches>("modules", "/org/modules", { refreshOnForeground: true });
  return { ...ALL_ON, ...(data ?? {}) };
}
