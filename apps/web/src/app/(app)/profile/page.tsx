import { AppShellHeader } from "@spine/ui";
import { ProfileView } from "./profile-view";

/**
 * PRD S-10.17 — self-service account editing (name, email, password,
 * avatar, theme), available to every role including Field. Deliberately
 * outside both the Owner-gated /team/* area and the org-config Settings
 * dialog — reachable from the user menu regardless of role, unlike either
 * of those.
 */
export default function ProfilePage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Profile & Preferences" }]} title="Profile & Preferences" />
      <ProfileView />
    </>
  );
}
