import { AcceptInviteView } from "./accept-invite-view";

export default async function AcceptInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AcceptInviteView invitationId={id} />;
}
