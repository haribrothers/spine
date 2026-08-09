"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Spinner,
  Table,
  type TableColumn,
} from "@spine/ui";
import { Shield } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import type { TeamSummary } from "../../../../lib/teams";

export function TeamsExplorer() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    try {
      const rows = await apiClient.get<TeamSummary[]>("/org/teams");
      setTeams(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load teams.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const created = await apiClient.post<TeamSummary>("/org/teams", { name: newName });
      setCreateOpen(false);
      setNewName("");
      router.push(`/team/teams/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create team.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(team: TeamSummary) {
    setError(null);
    try {
      await apiClient.delete(`/org/teams/${team.id}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete team.");
    }
  }

  const columns: TableColumn<TeamSummary>[] = [
    {
      key: "name",
      header: "Team",
      render: (team) => (
        <a href={`/team/teams/${team.id}`} className="flex items-center gap-2 font-medium text-on-surface hover:underline">
          {team.name}
          {team.isDefault && <Badge>Default</Badge>}
        </a>
      ),
      sortValue: (team) => team.name,
    },
    {
      key: "memberCount",
      header: "Members",
      render: (team) => <span>{team.memberCount}</span>,
      sortValue: (team) => team.memberCount,
      align: "right",
    },
    {
      key: "actions",
      header: "",
      render: (team) => {
        const disabled = team.isDefault || (teams?.length ?? 0) <= 1;
        return (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                title={team.isDefault ? "The default team can't be deleted" : disabled ? "An org needs at least one team" : undefined}
              >
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {team.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Members of this team lose whatever access it granted. This doesn&apos;t delete the members
                  themselves, only their membership in this team.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(team)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
      align: "right",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>Create team</Button>
      </div>

      {!teams ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : teams.length === 0 ? (
        <EmptyState icon={<Shield />} title="No teams yet" description="Create a team to start configuring Staff access." />
      ) : (
        <Table columns={columns} data={teams} rowKey={(team) => team.id} />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label="Team name">
              {(field) => (
                <Input {...field} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Site Crew A" autoFocus />
              )}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Spinner size="sm" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
